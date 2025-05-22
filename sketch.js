
// --- CONFIGURATION CONSTANTS ---
const CONFIG = {
    GRID_ROWS: 6,
    GRID_COLS: 8,
    TOP_UI_SPACE: 40,
    BOTTOM_UI_SPACE: 10,
    HAND_CARD_MARGIN: 10,
    HAND_CARD_WIDTH: 80,
    HAND_CARD_HEIGHT: 100,
    CARD_MENU_BUTTON_WIDTH: 60,
    CARD_MENU_BUTTON_HEIGHT: 20,
    STARTING_MANA: 5,
    INITIAL_HAND_SIZE: 3,
    MAX_MOVES_PER_TURN: 3,
    MAX_ATTACKS_PER_TURN: 3,
};

// --- GLOBAL GAME VARIABLES (Derived from CONFIG or P5) ---
let cellWidth, cellHeight;

// --- GAME STATE ---
let gameState = {
    units: [],
    player1Hand: [],
    player2Hand: [],
    currentPlayerIsP1: true,
    player1Mana: 0,
    player2Mana: 0,
    movesMadeThisTurn: 0,
    attacksMadeThisTurn: 0,
    gameOver: false,
    winnerMessage: "",
    attackAnimations: [],
    currentDiceRollResult: "",
    selectedUnit: null,
    selectedCardForSummoning: null,
    potentialMoveCells: [],
    potentialAttackCells: [],
    potentialSummonCells: [],
    ALL_AVAILABLE_CARDS: [],
};

// --- UI ELEMENTS / MANAGERS ---
let actionButtonRect;

class CardActionMenuManager {
    constructor() {
        this.active = false; this.card = null; this.cardIndexInHand = -1;
        this.playButtonRect = { x:0,y:0,w:CONFIG.CARD_MENU_BUTTON_WIDTH,h:CONFIG.CARD_MENU_BUTTON_HEIGHT,text:"Play"};
        this.scrapButtonRect = { x:0,y:0,w:CONFIG.CARD_MENU_BUTTON_WIDTH,h:CONFIG.CARD_MENU_BUTTON_HEIGHT,text:"Scrap (1M)"};
    }
    open(card, indexInHand, cardDisplayX, cardDisplayY, cardDisplayWidth, cardDisplayHeight) {
        this.active = true; this.card = card; this.cardIndexInHand = indexInHand;
        this.playButtonRect.x = cardDisplayX + cardDisplayWidth/2 - this.playButtonRect.w/2;
        this.playButtonRect.y = cardDisplayY - this.playButtonRect.h - 5;
        this.scrapButtonRect.x = this.playButtonRect.x;
        this.scrapButtonRect.y = this.playButtonRect.y - this.scrapButtonRect.h - 5;
        if (this.scrapButtonRect.y < 5) {
            this.playButtonRect.y = cardDisplayY + cardDisplayHeight + 5;
            this.scrapButtonRect.y = this.playButtonRect.y + this.scrapButtonRect.h + 5;
        }
    }
    close() { this.active = false; this.card = null; this.cardIndexInHand = -1; }
    draw() {
        if (!this.active || !this.card) return; push();
        fill(120,70,80); rect(this.playButtonRect.x,this.playButtonRect.y,this.playButtonRect.w,this.playButtonRect.h,3);
        fill(0);textAlign(CENTER,CENTER);textSize(10);text(this.playButtonRect.text,this.playButtonRect.x+this.playButtonRect.w/2,this.playButtonRect.y+this.playButtonRect.h/2);
        fill(20,70,80); rect(this.scrapButtonRect.x,this.scrapButtonRect.y,this.scrapButtonRect.w,this.scrapButtonRect.h,3);
        fill(0);text(this.scrapButtonRect.text,this.scrapButtonRect.x+this.scrapButtonRect.w/2,this.scrapButtonRect.y+this.scrapButtonRect.h/2); pop();
    }
    handleMousePress(mx, my) {
        if (!this.active) return false;
        let currentMana = gameState.currentPlayerIsP1 ? gameState.player1Mana : gameState.player2Mana;
        let actionTaken = false;
        if (isMouseOverRect(mx,my,this.playButtonRect)) {
            if (this.card.summonCost <= currentMana) {
                deselectUnitSelections(); gameState.selectedCardForSummoning = this.card; calculatePotentialSummonCells();
            } else { console.log("Not enough mana for Play."); gameState.selectedCardForSummoning = null; gameState.potentialSummonCells = []; }
            this.close(); actionTaken = true;
        } else if (isMouseOverRect(mx,my,this.scrapButtonRect)) {
            if (gameState.currentPlayerIsP1) { gameState.player1Mana++; gameState.player1Hand.splice(this.cardIndexInHand,1); }
            else { gameState.player2Mana++; gameState.player2Hand.splice(this.cardIndexInHand,1); }
            deselectAllSelections(); actionTaken = true;
        }
        return actionTaken;
    }
}
let cardActionMenu = new CardActionMenuManager();

class Card {
    constructor(unitName, unitType, attackValue, lifePoints, rangeType, summonCost, isSummonerCard = false) {
        this.unitName=unitName; this.unitType=unitType; this.attackValue=attackValue; this.lifePoints=lifePoints;
        this.rangeType=rangeType; this.summonCost=summonCost; this.isSummonerCard=isSummonerCard;
        this.id=unitName+"_"+summonCost+"_"+Math.random().toString(16).slice(9);
    }
    createUnit(row,col,isPlayer1){return new Unit(this.unitName,row,col,isPlayer1,this.attackValue,this.lifePoints,this.rangeType,this.unitType,this.isSummonerCard);}
    isMouseOver(mx,my){return mx>this.displayX&&mx<this.displayX+this.displayWidth&&my>this.displayY&&my<this.displayY+this.displayHeight;}
}

class Unit {
  constructor(name, r, c, isPlayer1, attackValue, lifePoints, rangeType, type, isSummoner = false) {
    this.name=name; this.row=r; this.col=c; this.isPlayer1=isPlayer1;
    this.attackValue=attackValue; this.maxLifePoints=lifePoints; this.currentLifePoints=lifePoints;
    this.rangeType=rangeType; this.attackRange=(rangeType==='melee')?1:3;
    this.moveRange=2; this.type=type; this.isSummoner=isSummoner;
    this.color=isPlayer1?color(240,80,90):color(0,80,90);
    this.id=name+"_"+r+"_"+c+(isPlayer1?"_P1":"_P2")+Math.random().toString(16).slice(5);
    this.isSelected=false; this.hasMovedThisTurn=false; this.hasAttackedThisTurn=false;
    this.isHovered=false; this.size=0; this.isDestroyed=false;
  }
  getPixelPos(){return {x:this.col*cellWidth+cellWidth/2,y:CONFIG.TOP_UI_SPACE+this.row*cellHeight+cellHeight/2};}
  display() {
    let pos = this.getPixelPos(); this.size = min(cellWidth, cellHeight) * 0.7; // Slightly larger base for more detail
    push();
    translate(pos.x, pos.y);
    rectMode(CENTER); // Ensure consistent rectMode for unit drawing

    let bodyHue = hue(this.color);
    let bodySat = saturation(this.color);
    let bodyBri = brightness(this.color);

    if ((this.hasMovedThisTurn || this.hasAttackedThisTurn) && this.currentLifePoints > 0 && !gameState.gameOver) {
        bodySat *= 0.6; bodyBri *= 0.9;
    }

    if (this.isHovered && this.currentLifePoints > 0 && !gameState.gameOver) { stroke(50,100,100); strokeWeight(3); } else { noStroke(); }
    if (this.isSelected && this.currentLifePoints > 0 && !gameState.gameOver) { fill(bodyHue,bodySat,bodyBri+10,50); ellipse(0,0,this.size*1.2,this.size*1.2); stroke(0,0,100); strokeWeight(2); } // Selection slightly smaller relative to new unit size

    noStroke();
    if (this.currentLifePoints <= 0) {
        fill(0,0,30); ellipse(0,0,this.size*0.8, this.size*0.8); // Dead units are simple dark circles
    } else {
        // Base fill for most parts
        fill(bodyHue, bodySat, bodyBri);

        switch (this.type) {
            case "Summoner":
                ellipse(0, this.size * 0.1, this.size * 0.7, this.size * 0.8); // Robe body
                fill(bodyHue, bodySat * 0.8, bodyBri + 15); // Lighter for hat
                triangle(0, -this.size * 0.5, -this.size * 0.3, -this.size * 0.05, this.size * 0.3, -this.size * 0.05); // Pointed hat
                fill(60, 80, 100); // Orb color (yellowish)
                ellipse(0, -this.size * 0.15, this.size * 0.2, this.size * 0.2); // Orb
                break;
            case "Archer":
                ellipse(0, this.size * 0.1, this.size * 0.4, this.size * 0.7); // Body
                stroke(40, 50, 30); strokeWeight(this.size * 0.05); noFill(); // Bow color (brownish)
                arc(this.size * 0.2, 0, this.size * 0.6, this.size * 0.8, PI + HALF_PI * 0.7, HALF_PI * 0.3); // Bow arc
                stroke(0, 0, 70); strokeWeight(this.size*0.03); // Arrow shaft
                line(this.size * 0.05, 0, this.size*0.4, 0); // Arrow shaft
                fill(0,0,70); noStroke(); // Arrow head
                triangle(this.size*0.4, 0, this.size*0.3, -this.size*0.05, this.size*0.3, this.size*0.05);
                break;
            case "Warrior":
                rect(0, 0, this.size * 0.6, this.size * 0.8, this.size * 0.1); // Body
                fill(0, 0, 70); // Shield color (grey)
                beginShape(); // Kite Shield
                vertex(-this.size * 0.3, -this.size * 0.4); vertex(this.size * 0.15, -this.size * 0.35);
                vertex(this.size * 0.15, this.size * 0.25); vertex(0, this.size * 0.4);
                vertex(-this.size * 0.3, this.size * 0.25); endShape(CLOSE);
                fill(0, 0, 80); // Sword color
                rect(this.size * 0.25, 0, this.size * 0.1, this.size * 0.6); // Sword blade
                rect(this.size * 0.25, this.size*0.2, this.size * 0.25, this.size*0.05); // Crossguard
                break;
            case "Spearman":
                ellipse(0, this.size * 0.1, this.size * 0.4, this.size * 0.7); // Body
                fill(0, 0, 70); // Buckler color
                ellipse(-this.size * 0.15, 0, this.size * 0.3, this.size * 0.3);
                stroke(40, 50, 30); strokeWeight(this.size * 0.05); // Spear shaft
                line(this.size * 0.1, -this.size * 0.4, this.size * 0.1, this.size * 0.3);
                fill(0, 0, 80); noStroke(); // Spear head
                triangle(this.size*0.1, -this.size*0.5, this.size*0.02, -this.size*0.35, this.size*0.18, -this.size*0.35);
                break;
            case "Brute":
                beginShape(); // Trapezoid body
                vertex(-this.size * 0.4, this.size * 0.4); vertex(this.size * 0.4, this.size * 0.4);
                vertex(this.size * 0.3, -this.size * 0.4); vertex(-this.size * 0.3, -this.size * 0.4);
                endShape(CLOSE);
                fill(40, 60, 40); // Club color (dark brown)
                ellipse(this.size*0.3, -this.size*0.1, this.size*0.25, this.size*0.5); // Club head
                rect(this.size*0.3, this.size*0.2, this.size*0.1, this.size*0.2); // Club handle
                break;
            case "Scout":
                fill(bodyHue, bodySat * 0.7, bodyBri * 0.8); // Hood color (slightly darker)
                arc(0, -this.size * 0.1, this.size * 0.7, this.size * 0.8, PI, 0, CHORD); // Hood
                fill(bodyHue, bodySat, bodyBri); // Face area (player color)
                ellipse(0, this.size*0.05, this.size * 0.4, this.size * 0.5); // Head/body under hood
                break;
            case "Guard":
                rect(0, 0, this.size * 0.5, this.size * 0.8, this.size * 0.1); // Body
                fill(0, 0, 65); // Shield color
                rect(-this.size * 0.15, 0, this.size * 0.3, this.size * 0.9, this.size*0.05); // Tower shield
                fill(bodyHue, bodySat * 0.8, bodyBri + 5); // Helmet
                arc(0, -this.size*0.3, this.size*0.4, this.size*0.3, PI, 0, OPEN);
                break;
            default: ellipse(0, 0, this.size, this.size);
        }
        if (this.rangeType === 'ranged') {
            push(); stroke(60,80,100); strokeWeight(this.size*0.04); noFill();
            arc(this.size*0.35, -this.size*0.35, this.size*0.15, this.size*0.15, PI*1.25, PI*1.75); // Small upper right arc
            pop();
        }
    }
    rectMode(CORNER); // Reset rectMode
    noStroke(); fill(0); textAlign(CENTER,BOTTOM); textSize(min(cellWidth/5,11)); text(this.name,0,-this.size*0.55 - (this.type==="Summoner"?this.size*0.1:0) ); // Adjusted name pos

    if (this.currentLifePoints > 0) {
        let hpBarY = this.size * 0.5 + 5;
        fill(0,0,20); rect(-this.size*0.4,hpBarY,this.size*0.8,8,2);
        fill(120,100,80); let hpWidth=map(this.currentLifePoints,0,this.maxLifePoints,0,this.size*0.8); rect(-this.size*0.4,hpBarY,hpWidth,8,2);
        fill(0); textAlign(CENTER,CENTER); textSize(10); text(`${this.currentLifePoints}`,0,hpBarY+4);
    } else {
        fill(0,0,100); textAlign(CENTER,CENTER); textSize(this.size*0.7); text("X",0,0);
    }
    pop();
  }
  isMouseOver(mx,my){let pos=this.getPixelPos();let d=dist(mx,my,pos.x,pos.y);return d<this.size/2*1.2;}
  takeDamage(amount){this.currentLifePoints-=amount;if(this.currentLifePoints<0)this.currentLifePoints=0;}
  canMoveNow(){return this.currentLifePoints>0&&!this.hasMovedThisTurn&&gameState.movesMadeThisTurn<CONFIG.MAX_MOVES_PER_TURN;}
  canAttackNow(){return this.currentLifePoints>0&&!this.hasAttackedThisTurn&&gameState.attacksMadeThisTurn<CONFIG.MAX_ATTACKS_PER_TURN;}
  getValidMoveCells(){let pM=[];if(!this.canMoveNow())return pM;let q=[{r:this.row,c:this.col,steps:0}];let v=new Set([`${this.row},${this.col}`]);while(q.length>0){let cur=q.shift();if(cur.steps>0&&!getUnitAt(cur.r,cur.c))pM.push({row:cur.r,col:cur.c});if(cur.steps<this.moveRange){let ad=[[-1,0],[1,0],[0,-1],[0,1]];for(let a of ad){let nR=cur.r+a[0];let nC=cur.c+a[1];let nK=`${nR},${nC}`;if(isCellOnBoard(nR,nC)&&!v.has(nK)){if(!getUnitAt(nR,nC)){v.add(nK);q.push({r:nR,c:nC,steps:cur.steps+1})}}}}}return pM;}
  getValidAttackCells(){let tgts=[];if(!this.canAttackNow())return tgts;if(this.rangeType==='melee'){const ad=[[-1,0],[1,0],[0,-1],[0,1]];for(let a of ad){let r=this.row+a[0];let c=this.col+a[1];if(isCellOnBoard(r,c)){let uC=getUnitAt(r,c);if(uC&&uC.isPlayer1!==this.isPlayer1&&uC.currentLifePoints>0)tgts.push({row:r,col:c})}}}else if(this.rangeType==='ranged'){const dirs=[[-1,0],[1,0],[0,-1],[0,1]];for(let d of dirs){for(let i=1;i<=this.attackRange;i++){let r=this.row+d[0]*i;let c=this.col+d[1]*i;if(!isCellOnBoard(r,c))break;let uC=getUnitAt(r,c);if(uC){if(uC.isPlayer1!==this.isPlayer1&&uC.currentLifePoints>0)tgts.push({row:r,col:c});break}}}};return tgts;}
  moveTo(r,c){this.row=r;this.col=c;this.hasMovedThisTurn=true;gameState.movesMadeThisTurn++;}
  attack(targetUnit){
    let hits=0;let dR=[];for(let i=0;i<this.attackValue;i++){let r=floor(random(1,7));dR.push(r);if(r>=3)hits++}
    gameState.currentDiceRollResult=`${this.name}(${this.isPlayer1?'P1':'P2'}) attacks ${targetUnit.name}(${targetUnit.isPlayer1?'P1':'P2'})! Rolls:[${dR.join(',')}] -> ${hits} Hits.`;
    targetUnit.takeDamage(hits);
    if(targetUnit.currentLifePoints<=0&&!targetUnit.isDestroyed){let mG=Math.floor(targetUnit.maxLifePoints/2);if(this.isPlayer1)gameState.player1Mana+=mG;else gameState.player2Mana+=mG;targetUnit.isDestroyed=true}
    this.hasAttackedThisTurn=true;gameState.attacksMadeThisTurn++;
    let aP=this.getPixelPos();let tP=targetUnit.getPixelPos();gameState.attackAnimations.push({attackerPos:aP,targetPos:tP,timer:60,duration:60});
    checkGameEndCondition();return true;
  }
}

function populateAllAvailableCards(){gameState.ALL_AVAILABLE_CARDS=[new Card("Archer","Archer",1,3,'ranged',3),new Card("Warrior","Warrior",3,4,'melee',4),new Card("Spearman","Spearman",2,3,'ranged',3),new Card("Brute","Brute",3,5,'melee',5),new Card("Scout","Scout",1,2,'ranged',2),new Card("Guard","Guard",2,5,'melee',4)];}
function initializeUnits(){gameState.units=[];gameState.units.push(new Unit("Summoner",CONFIG.GRID_ROWS-1,floor(CONFIG.GRID_COLS/2)-1,true,2,6,'melee',"Summoner",true));gameState.units.push(new Unit("Summoner",0,floor(CONFIG.GRID_COLS/2)-1,false,2,6,'melee',"Summoner",true));}
function drawNewCardForPlayer(isPlayer1){if(gameState.ALL_AVAILABLE_CARDS.length===0){console.log("Master Deck is empty!");return;}let cardTemplate=random(gameState.ALL_AVAILABLE_CARDS);let newDrawnCard=new Card(cardTemplate.unitName,cardTemplate.unitType,cardTemplate.attackValue,cardTemplate.lifePoints,cardTemplate.rangeType,cardTemplate.summonCost,cardTemplate.isSummonerCard);if(isPlayer1)gameState.player1Hand.push(newDrawnCard);else gameState.player2Hand.push(newDrawnCard);}
function initializeManaAndHands(){gameState.player1Mana=CONFIG.STARTING_MANA;gameState.player2Mana=CONFIG.STARTING_MANA;gameState.player1Hand=[];gameState.player2Hand=[];for(let i=0;i<CONFIG.INITIAL_HAND_SIZE;i++){drawNewCardForPlayer(true);drawNewCardForPlayer(false);}}
function setupGame(){populateAllAvailableCards();initializeUnits();initializeManaAndHands();gameState.currentPlayerIsP1=true;gameState.movesMadeThisTurn=0;gameState.attacksMadeThisTurn=0;gameState.currentDiceRollResult="";gameState.gameOver=false;gameState.winnerMessage="";gameState.selectedUnit=null;gameState.selectedCardForSummoning=null;gameState.potentialMoveCells=[];gameState.potentialAttackCells=[];gameState.potentialSummonCells=[];gameState.attackAnimations=[];cardActionMenu.close();actionButtonRect.text="End Turn";}
function resetGame(){setupGame();}

function setup(){createCanvas(800,700);colorMode(HSB,360,100,100,100);cellWidth=width/CONFIG.GRID_COLS;cellHeight=(height-CONFIG.TOP_UI_SPACE-CONFIG.BOTTOM_UI_SPACE-CONFIG.HAND_CARD_HEIGHT-CONFIG.HAND_CARD_MARGIN)/CONFIG.GRID_ROWS;actionButtonRect={x:width-110,y:height-40,w:100,h:30,text:"End Turn"};setupGame();}

function drawGrid(){stroke(0,0,70);strokeWeight(1);let gridBottomY=height-CONFIG.HAND_CARD_HEIGHT-CONFIG.HAND_CARD_MARGIN-CONFIG.BOTTOM_UI_SPACE;for(let r=0;r<=CONFIG.GRID_ROWS;r++)line(0,CONFIG.TOP_UI_SPACE+r*cellHeight,width,CONFIG.TOP_UI_SPACE+r*cellHeight);for(let c=0;c<=CONFIG.GRID_COLS;c++)line(c*cellWidth,CONFIG.TOP_UI_SPACE,c*cellWidth,gridBottomY);stroke(0,0,50);strokeWeight(2);line(0,CONFIG.TOP_UI_SPACE+(gridBottomY-CONFIG.TOP_UI_SPACE)/2,width,CONFIG.TOP_UI_SPACE+(gridBottomY-CONFIG.TOP_UI_SPACE)/2);}
function drawHighlights(){if(gameState.gameOver)return;noStroke();fill(200,60,100,30);for(let cell of gameState.potentialMoveCells)rect(cell.col*cellWidth,CONFIG.TOP_UI_SPACE+cell.row*cellHeight,cellWidth,cellHeight);fill(120,70,90,40);for(let cell of gameState.potentialAttackCells)rect(cell.col*cellWidth,CONFIG.TOP_UI_SPACE+cell.row*cellHeight,cellWidth,cellHeight);fill(60,100,100,40);for(let cell of gameState.potentialSummonCells)rect(cell.col*cellWidth,CONFIG.TOP_UI_SPACE+cell.row*cellHeight,cellWidth,cellHeight);}
function drawUnits(){for(let unit of gameState.units)unit.display();}
function drawAttackAnimations(){for(let i=gameState.attackAnimations.length-1;i>=0;i--){let anim=gameState.attackAnimations[i];anim.timer--;if(anim.timer<=0){gameState.attackAnimations.splice(i,1);if(gameState.attackAnimations.length===0)gameState.currentDiceRollResult=""}else{push();let alpha=map(anim.timer,anim.duration,0,100,0);stroke(0,100,100,alpha);strokeWeight(3);line(anim.attackerPos.x,anim.attackerPos.y,anim.targetPos.x,anim.targetPos.y);pop()}}}
function drawGameUI(){let topUiY=15;fill(0);textSize(14);if(!gameState.gameOver){textAlign(LEFT,TOP);text(`Player ${gameState.currentPlayerIsP1?'1 (Blue)':'2 (Red)'}'s Turn. M: ${gameState.movesMadeThisTurn}/${CONFIG.MAX_MOVES_PER_TURN}. A: ${gameState.attacksMadeThisTurn}/${CONFIG.MAX_ATTACKS_PER_TURN}`,10,topUiY);text(`Mana: ${gameState.currentPlayerIsP1?gameState.player1Mana:gameState.player2Mana}`,width/2-150,topUiY);textAlign(CENTER,TOP);if(gameState.currentDiceRollResult)text(gameState.currentDiceRollResult,width/2,topUiY+20);}else{textAlign(CENTER,TOP);textSize(24);fill(0,80,100);text(gameState.winnerMessage,width/2,topUiY+10);}fill(gameState.gameOver?color(120,70,80):color(10,30,80));rect(actionButtonRect.x,actionButtonRect.y,actionButtonRect.w,actionButtonRect.h,5);fill(0);textAlign(CENTER,CENTER);textSize(14);text(actionButtonRect.text,actionButtonRect.x+actionButtonRect.w/2,actionButtonRect.y+actionButtonRect.h/2);}
function drawPlayerHand(){if(gameState.gameOver)return;let currentHand=gameState.currentPlayerIsP1?gameState.player1Hand:gameState.player2Hand;let handStartX=20;let handDisplayBaseY=height-CONFIG.HAND_CARD_HEIGHT-5;for(let i=0;i<currentHand.length;i++){let card=currentHand[i];card.displayX=handStartX+i*(CONFIG.HAND_CARD_WIDTH+10);card.displayY=handDisplayBaseY;card.displayWidth=CONFIG.HAND_CARD_WIDTH;card.displayHeight=CONFIG.HAND_CARD_HEIGHT;push();translate(card.displayX,card.displayY);strokeWeight(2);if(cardActionMenu.active&&cardActionMenu.card&&cardActionMenu.card.id===card.id)stroke(60,100,100);else if(gameState.selectedCardForSummoning&&gameState.selectedCardForSummoning.id===card.id)stroke(60,80,100);else stroke(0,0,20);let currentMana=gameState.currentPlayerIsP1?gameState.player1Mana:gameState.player2Mana;if(card.summonCost>currentMana)fill(0,0,50,70);else fill(45,20,95);rect(0,0,card.displayWidth,card.displayHeight,5);fill(0);noStroke();textAlign(CENTER,TOP);textSize(12);text(card.unitName,card.displayWidth/2,10);textSize(10);text(`Cost: ${card.summonCost}`,card.displayWidth/2,card.displayHeight-25);text(`A:${card.attackValue} L:${card.lifePoints}`,card.displayWidth/2,card.displayHeight-12);pop();}}

function draw(){background(60,10,95);gameState.units=gameState.units.filter(unit=>!unit.isDestroyed);drawGrid();if(!gameState.gameOver){for(let unit of gameState.units)unit.isHovered=unit.isMouseOver(mouseX,mouseY);drawHighlights();}drawUnits();drawAttackAnimations();drawGameUI();drawPlayerHand();cardActionMenu.draw();}

function pixelToGrid(mx,my){let gridAreaTop=CONFIG.TOP_UI_SPACE;let gridAreaBottom=height-CONFIG.HAND_CARD_HEIGHT-CONFIG.HAND_CARD_MARGIN-CONFIG.BOTTOM_UI_SPACE;if(my<gridAreaTop||my>gridAreaBottom)return null;let c=floor(mx/cellWidth);let r=floor((my-gridAreaTop)/cellHeight);if(r>=0&&r<CONFIG.GRID_ROWS&&c>=0&&c<CONFIG.GRID_COLS)return{row:r,col:c};return null;}
function getUnitAt(r,c){for(let unit of gameState.units){if(unit.row===r&&unit.col===c&&unit.currentLifePoints>0)return unit;}return null;}
function isCellOnBoard(r,c){return r>=0&&r<CONFIG.GRID_ROWS&&c>=0&&c<CONFIG.GRID_COLS;}
function deselectUnitSelections(){if(gameState.selectedUnit)gameState.selectedUnit.isSelected=false;gameState.selectedUnit=null;gameState.potentialMoveCells=[];gameState.potentialAttackCells=[];}
function deselectAllSelections(){deselectUnitSelections();gameState.selectedCardForSummoning=null;gameState.potentialSummonCells=[];cardActionMenu.close();}
function selectUnitForAction(unit){deselectAllSelections();gameState.selectedUnit=unit;unit.isSelected=true;refreshPotentialUnitActions();}
function refreshPotentialUnitActions(){if(!gameState.selectedUnit)return;gameState.potentialMoveCells=gameState.selectedUnit.getValidMoveCells();gameState.potentialAttackCells=gameState.selectedUnit.getValidAttackCells();}
function calculatePotentialSummonCells(){gameState.potentialSummonCells=[];if(!gameState.selectedCardForSummoning)return;let summonerUnit=gameState.units.find(u=>u.isSummoner&&u.isPlayer1===gameState.currentPlayerIsP1&&u.currentLifePoints>0);if(!summonerUnit)return;const adjacents=[[-1,0],[1,0],[0,-1],[0,1]];for(let adj of adjacents){let r=summonerUnit.row+adj[0];let c=summonerUnit.col+adj[1];if(isCellOnBoard(r,c)&&!getUnitAt(r,c))gameState.potentialSummonCells.push({row:r,col:c});}}
function checkGameEndCondition(){let p1S=false;let p2S=false;for(let u of gameState.units){if(u.isSummoner){if(u.isPlayer1&&u.currentLifePoints>0)p1S=true;if(!u.isPlayer1&&u.currentLifePoints>0)p2S=true;}}if(!p1S){gameState.gameOver=true;gameState.winnerMessage="Game Over! Player 2 (Red) Wins!";actionButtonRect.text="Restart Game";deselectAllSelections();}else if(!p2S){gameState.gameOver=true;gameState.winnerMessage="Game Over! Player 1 (Blue) Wins!";actionButtonRect.text="Restart Game";deselectAllSelections();}}
function endTurn(){gameState.currentPlayerIsP1=!gameState.currentPlayerIsP1;gameState.movesMadeThisTurn=0;gameState.attacksMadeThisTurn=0;gameState.currentDiceRollResult="";for(let unit of gameState.units){unit.hasMovedThisTurn=false;unit.hasAttackedThisTurn=false;}drawNewCardForPlayer(gameState.currentPlayerIsP1);deselectAllSelections();}

function isMouseOverRect(mx,my,rect){return mx>rect.x&&mx<rect.x+rect.w&&my>rect.y&&my<rect.y+rect.h;}
function isMouseOverAnyCardInHand(mx,my){let hand=gameState.currentPlayerIsP1?gameState.player1Hand:gameState.player2Hand;for(let card of hand){if(card.isMouseOver(mx,my))return true;}return false;}
function handleActionButtonClick(){if(gameState.gameOver)resetGame();else endTurn();}
function handleHandCardClick(mx,my){let currentHand=gameState.currentPlayerIsP1?gameState.player1Hand:gameState.player2Hand;for(let i=0;i<currentHand.length;i++){let card=currentHand[i];if(card.isMouseOver(mx,my)){if(cardActionMenu.active&&cardActionMenu.card&&cardActionMenu.card.id===card.id){}else if(gameState.selectedCardForSummoning&&gameState.selectedCardForSummoning.id===card.id){deselectAllSelections();cardActionMenu.open(card,i,card.displayX,card.displayY,card.displayWidth,card.displayHeight);}else{deselectAllSelections();cardActionMenu.open(card,i,card.displayX,card.displayY,card.displayWidth,card.displayHeight);}return true;}}return false;}
function handleGridClick(mx,my,gridPos){let clickedUnitInstance=getUnitAt(gridPos.row,gridPos.col);if(gameState.selectedCardForSummoning){let placed=false;for(let cell of gameState.potentialSummonCells){if(cell.row===gridPos.row&&cell.col===gridPos.col){let newUnit=gameState.selectedCardForSummoning.createUnit(gridPos.row,gridPos.col,gameState.currentPlayerIsP1);gameState.units.push(newUnit);if(gameState.currentPlayerIsP1)gameState.player1Mana-=gameState.selectedCardForSummoning.summonCost;else gameState.player2Mana-=gameState.selectedCardForSummoning.summonCost;if(gameState.currentPlayerIsP1)gameState.player1Hand=gameState.player1Hand.filter(c=>c.id!==gameState.selectedCardForSummoning.id);else gameState.player2Hand=gameState.player2Hand.filter(c=>c.id!==gameState.selectedCardForSummoning.id);placed=true;break;}}deselectAllSelections();return true;}else if(gameState.selectedUnit){let actionPerformed=false;if(gameState.selectedUnit.canMoveNow()){for(let mC of gameState.potentialMoveCells){if(mC.row===gridPos.row&&mC.col===gridPos.col){gameState.selectedUnit.moveTo(gridPos.row,gridPos.col);actionPerformed=true;break;}}}if(!actionPerformed&&gameState.selectedUnit.canAttackNow()){for(let aC of gameState.potentialAttackCells){if(aC.row===gridPos.row&&aC.col===gridPos.col){let tU=getUnitAt(aC.row,aC.col);if(tU&&tU.isPlayer1!==gameState.selectedUnit.isPlayer1){gameState.selectedUnit.attack(tU);actionPerformed=true;}break;}}}if(actionPerformed){if(!gameState.selectedUnit.canMoveNow()&&!gameState.selectedUnit.canAttackNow())deselectAllSelections();else refreshPotentialUnitActions();}else{if(clickedUnitInstance&&clickedUnitInstance.isPlayer1===gameState.currentPlayerIsP1)selectUnitForAction(clickedUnitInstance);else deselectAllSelections();}return true;}else{if(clickedUnitInstance&&clickedUnitInstance.isPlayer1===gameState.currentPlayerIsP1){if(clickedUnitInstance.canMoveNow()||clickedUnitInstance.canAttackNow())selectUnitForAction(clickedUnitInstance);}else{deselectAllSelections();}return true;}}

function mousePressed(){if(mouseButton!==LEFT)return;if(isMouseOverRect(mouseX,mouseY,actionButtonRect)){handleActionButtonClick();return;}if(gameState.gameOver)return;if(cardActionMenu.active){if(cardActionMenu.handleMousePress(mouseX,mouseY))return;}if(handleHandCardClick(mouseX,mouseY))return;if(cardActionMenu.active&&!isMouseOverAnyCardInHand(mouseX,mouseY)){deselectAllSelections();}let gridPos=pixelToGrid(mouseX,mouseY);if(gridPos){handleGridClick(mouseX,mouseY,gridPos);return;}if(!cardActionMenu.active){deselectAllSelections();}}
function windowResized(){/* Not dynamically used */}
