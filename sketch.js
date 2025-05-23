// --- CONFIGURATION CONSTANTS ---
const CONFIG = {
    GRID_ROWS: 8,
    GRID_COLS: 6,
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
    BATTLE_RESULT_DISPLAY_TIME: 360, // Animation frames to show battle results (3 seconds at 60fps)
};

// --- GLOBAL GAME VARIABLES (Derived from CONFIG or P5) ---
let cellWidth, cellHeight;

const PHASES = {
    SUMMON: "Summon",
    MOVE: "Move",
    BUILD: "Build",
    ATTACK: "Attack",
    MAGIC: "Magic",
    DRAW: "Draw"
};
const PHASE_ORDER = [PHASES.SUMMON, PHASES.MOVE, PHASES.BUILD, PHASES.ATTACK, PHASES.MAGIC, PHASES.DRAW];

// --- GAME STATE ---
let gameState = {
    units: [],
    player1Hand: [],
    player2Hand: [],
    currentPlayerIsP1: true,
    player1Mana: 0,
    player2Mana: 0,
    currentPhase: PHASE_ORDER[0], // Start with the first phase
    movesMadeThisTurn: 0, // Will be refined for "up to 3 different units"
    attacksMadeThisTurn: 0, // Will be refined for "up to 3 different units"
    unitsMovedThisPhase: [], // To track unique units moved in Move phase
    unitsAttackedThisPhase: [], // To track unique units attacked in Attack phase
    hasTargetedEnemyThisTurn: false, // For "Cost of Inaction" rule
    gameOver: false,
    winnerMessage: "",
    attackAnimations: [],
    currentDiceRollResult: "",
    battleResultDisplayTimer: 0,
    selectedUnit: null,
    selectedCardForSummoning: null,
    potentialMoveCells: [],
    potentialAttackCells: [],
    potentialSummonCells: [],
    ALL_AVAILABLE_CARDS: [],
    activeEvents: [],          // Active event cards in play
    selectedEventCard: null,   // Currently selected event card for targeting
    potentialEventTargets: []  // Grid cells or units eligible for event effect
};

// --- UI ELEMENTS / MANAGERS ---
let actionButtonRect;

class CardActionMenuManager {
    constructor() {
        this.active = false; this.card = null; this.cardIndexInHand = -1;
        this.playButtonRect = { x:0,y:0,w:CONFIG.CARD_MENU_BUTTON_WIDTH,h:CONFIG.CARD_MENU_BUTTON_HEIGHT,text:"Play"};
        this.scrapButtonRect = { x:0,y:0,w:CONFIG.CARD_MENU_BUTTON_WIDTH,h:CONFIG.CARD_MENU_BUTTON_HEIGHT,text:"Scrap"};
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
                if (this.card.unitType === "Event") {
                    // Handle playing event cards
                    if ( (gameState.currentPhase === PHASES.SUMMON && this.card.specialAbility.phase === PHASES.SUMMON) || 
                         (gameState.currentPhase === PHASES.BUILD && this.card.specialAbility.phase === PHASES.BUILD) || 
                         (!this.card.specialAbility.phase) ) { // Some events might be playable anytime or have their phase checked elsewhere
                        
                        playEventCard(this.card);
                        if (gameState.currentPlayerIsP1) {
                            gameState.player1Mana -= this.card.summonCost;
                            gameState.player1Hand.splice(this.cardIndexInHand, 1);
                        } else {
                            gameState.player2Mana -= this.card.summonCost;
                            gameState.player2Hand.splice(this.cardIndexInHand, 1);
                        }
                        actionTaken = true;
                    } else {
                        console.log(`Cannot play ${this.card.unitName} during ${gameState.currentPhase} phase.`);
                    }
                } else if (gameState.currentPhase === PHASES.SUMMON || gameState.currentPhase === PHASES.BUILD) {
                    // Handle summoning units or building structures
                    deselectUnitSelections(); 
                    gameState.selectedCardForSummoning = this.card; 
                    calculatePotentialSummonCells(); // This function might need adjustment for structures
                } else {
                    console.log(`Cannot summon or build during ${gameState.currentPhase} phase.`);
                }
            } else { 
                console.log("Not enough mana for Play."); 
                gameState.selectedCardForSummoning = null; 
                gameState.potentialSummonCells = []; 
            }
            this.close(); 
            actionTaken = true; // Action is taken whether successful or not, to close the menu
        } else if (isMouseOverRect(mx,my,this.scrapButtonRect)) {
            if (gameState.currentPhase === PHASES.MAGIC) {
                if (gameState.currentPlayerIsP1) { 
                    gameState.player1Mana++; 
                    gameState.player1Hand.splice(this.cardIndexInHand,1); 
                } else { 
                    gameState.player2Mana++; 
                    gameState.player2Hand.splice(this.cardIndexInHand,1); 
                }
                actionTaken = true;
            } else {
                console.log("Can only scrap cards for mana during the Magic phase.");
            }
            deselectAllSelections(); // Close menu and deselect after scrapping or attempting to scrap
        }
        return actionTaken;
    }
}

function playEventCard(card) {
    console.log(`Playing event card: ${card.unitName}`);
    // Deduct mana and remove from hand handled by caller
    // Handle different event types
    switch (card.specialAbility.type) {
        case "BURN_EFFECT":
            // Prepare for target selection in Move phase
            gameState.selectedEventCard = card;
            calculateEventTargets(card);
            break;
        case "BLINDING_FLARE_EFFECT":
        case "DIVINE_RETRIBUTION_EFFECT":
        case "SPIRIT_OF_THE_PHOENIX":
            // Active events: remain in play until end of next turn
            gameState.activeEvents.push(card);
            break;
        default:
            console.warn(`No implementation for event type: ${card.specialAbility.type}`);
    }
    // Show feedback
    gameState.currentDiceRollResult = `Event: ${card.unitName} played.`;
    gameState.battleResultDisplayTimer = CONFIG.BATTLE_RESULT_DISPLAY_TIME;
}

// Calculate valid targets for event cards
function calculateEventTargets(card) {
    gameState.potentialEventTargets = [];
    const summoner = gameState.units.find(u => u.isSummoner && u.isPlayer1 === gameState.currentPlayerIsP1);
    if (!summoner) return;
    if (card.specialAbility.type === "BURN_EFFECT") {
        // Cells within 2 spaces of summoner containing a unit that is not a summoner
        for (let unit of gameState.units) {
            if (unit.isPlayer1 === gameState.currentPlayerIsP1 && !unit.isSummoner) {
                const dist = abs(unit.row - summoner.row) + abs(unit.col - summoner.col);
                if (dist <= 2) {
                    gameState.potentialEventTargets.push({ row: unit.row, col: unit.col });
                }
            }
        }
    }
}

let cardActionMenu = new CardActionMenuManager();

class Card {
    constructor(unitName, unitType, attackValue = null, lifePoints = null, rangeType = null, summonCost, isSummonerCard = false, specialAbility = null) {
        this.unitName = unitName;
        this.unitType = unitType; // Can be 'Summoner', 'Archer', 'Guard', 'Warrior', 'Brute', 'Event', etc.
        this.attackValue = attackValue;
        this.lifePoints = lifePoints;
        this.rangeType = rangeType;
        this.summonCost = summonCost;
        this.isSummonerCard = isSummonerCard; // True only for the initial summoner card, not for playable cards
        this.specialAbility = specialAbility; // Stores special ability info or event effect details
        this.id = unitName + "_" + summonCost + "_" + Math.random().toString(16).slice(9);
    }

    isMouseOver(mx, my) {
        return mx > this.displayX && mx < this.displayX + this.displayWidth &&
               my > this.displayY && my < this.displayY + this.displayHeight;
    }

    createUnit(row, col, isPlayer1) {
        if (this.unitType === "Event") {
            // Event cards don't create units
            console.log("Cannot create unit from an Event card:", this.unitName);
            return null;
        }
        return new Unit(
            this.unitName, row, col, isPlayer1,
            this.attackValue, this.lifePoints,
            this.rangeType, this.unitType, // unitType here refers to the type of unit (Archer, Guard etc)
            this.isSummonerCard, // This should generally be false when creating from a hand card
            this.specialAbility // Pass the unit's special ability
        );
    }
}

class Unit {
  constructor(name, r, c, isPlayer1, attackValue, lifePoints, rangeType, type, isSummoner = false, specialAbility = null) {
    this.name=name; this.row=r; this.col=c; this.isPlayer1=isPlayer1;
    this.attackValue=attackValue; 
    this.originalAttackValue=attackValue; // Store original attack value for resetting after temporary effects
    this.maxLifePoints=lifePoints; this.currentLifePoints=lifePoints;
    this.rangeType=rangeType; this.attackRange=(rangeType==='melee')?1:3;
    this.moveRange=2; this.type=type; this.isSummoner=isSummoner;
    this.color=isPlayer1?color(240,80,90):color(0,80,90);
    this.id=name+"_"+r+"_"+c+(isPlayer1?"_P1":"_P2")+Math.random().toString(16).slice(5);
    this.isSelected=false; this.hasMovedThisTurn=false; this.hasAttackedThisTurn=false;
    this.isHovered=false; this.size=0; this.isDestroyed=false;
    this.specialAbility=specialAbility; // Store the unit's special ability
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

    // Show visual indicators for active special abilities
    if (this.specialAbility && this.currentLifePoints > 0) {
      // Visual indicators for movement-based abilities that are currently active
      if ((this.specialAbility.type === "FIRE_CHARGE" || this.specialAbility.type === "ORC_CHARGE") && this.hasMovedThisTurn) {
        noFill();
        stroke(30, 100, 100); // Orange glow for movement-based abilities
        strokeWeight(2);
        ellipse(0, 0, this.size * 1.3, this.size * 1.3);
      } 
      // Permanent ability indicators
      else if (this.specialAbility.type === "MANA_BOOST" || this.specialAbility.type === "FROST_ARMOR" || 
               this.specialAbility.type === "ACCURACY" || this.specialAbility.type === "GIANT_STRENGTH") {
        noFill();
        stroke(210, 100, 100); // Blue glow for passive abilities
        strokeWeight(2);
        drawStar(0, 0, this.size * 0.15, this.size * 0.3, 5); // Small star indicator
      }
    }

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
  takeDamage(amount){
    // Implement Frost Armor for Grognack (reduces damage by 1 to a minimum of 1)
    if (this.specialAbility && this.specialAbility.type === "FROST_ARMOR" && amount > 1) {
      amount -= 1;
      gameState.currentDiceRollResult += " (Frost Armor reduced damage by 1)";
    }
    
    this.currentLifePoints -= amount;
    if(this.currentLifePoints < 0) this.currentLifePoints = 0;
  }
  canMoveNow(){return this.currentLifePoints>0&&!this.hasMovedThisTurn&&gameState.movesMadeThisTurn<CONFIG.MAX_MOVES_PER_TURN;}
  canAttackNow(){return this.currentLifePoints>0&&!this.hasAttackedThisTurn&&gameState.attacksMadeThisTurn<CONFIG.MAX_ATTACKS_PER_TURN;}
  getValidMoveCells(){let pM=[];if(!this.canMoveNow())return pM;let q=[{r:this.row,c:this.col,steps:0}];let v=new Set([`${this.row},${this.col}`]);while(q.length>0){let cur=q.shift();if(cur.steps>0&&!getUnitAt(cur.r,cur.c))pM.push({row:cur.r,col:cur.c});if(cur.steps<this.moveRange){let ad=[[-1,0],[1,0],[0,-1],[0,1]];for(let a of ad){let nR=cur.r+a[0];let nC=cur.c+a[1];let nK=`${nR},${nC}`;if(isCellOnBoard(nR,nC)&&!v.has(nK)){if(!getUnitAt(nR,nC)){v.add(nK);q.push({r:nR,c:nC,steps:cur.steps+1})}}}}}return pM;}
  getValidAttackCells(){let tgts=[];if(!this.canAttackNow())return tgts;if(this.rangeType==='melee'){const ad=[[-1,0],[1,0],[0,-1],[0,1]];for(let a of ad){let r=this.row+a[0];let c=this.col+a[1];if(isCellOnBoard(r,c)){let uC=getUnitAt(r,c);if(uC&&uC.isPlayer1!==this.isPlayer1&&uC.currentLifePoints>0)tgts.push({row:r,col:c})}}}else if(this.rangeType==='ranged'){const dirs=[[-1,0],[1,0],[0,-1],[0,1]];for(let d of dirs){for(let i=1;i<=this.attackRange;i++){let r=this.row+d[0]*i;let c=this.col+d[1]*i;if(!isCellOnBoard(r,c))break;let uC=getUnitAt(r,c);if(uC){if(uC.isPlayer1!==this.isPlayer1&&uC.currentLifePoints>0)tgts.push({row:r,col:c});break}}}};return tgts;}
  moveTo(r,c){this.row=r;this.col=c;this.hasMovedThisTurn=true; 
    if (!gameState.unitsMovedThisPhase.includes(this.id)) {
        gameState.unitsMovedThisPhase.push(this.id);
    }
  }
  attack(targetUnit){
    let hits=0;
    let dR=[];
    let bonusRoll = false;
    let specialAbilityText = "";
    
    // Apply special abilities that affect attack rolls
    if (this.specialAbility) {
      if (this.specialAbility.type === "ACCURACY") {
        // Ember Archer hits on 2+ instead of 3+
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 2) hits++;
        }
        specialAbilityText = " (Accuracy: hits on 2+)";
      } else if (this.specialAbility.type === "FIRE_BOMB" && !targetUnit.hasMovedThisTurn) {
        // Fire Bomber deals +2 damage to stationary targets
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) hits++;
        }
        hits += 2;
        specialAbilityText = " (Fire Bomb: +2 damage to stationary target)";
      } else if (this.specialAbility.type === "ICE_STRIKE" && hits > 0) {
        // Ice Shaman prevents target from moving next turn
        targetUnit.hasMovedThisTurn = true;
        specialAbilityText = " (Ice Strike: target cannot move)";
      } else if (this.specialAbility.type === "FENCER_STRIKE") {
        // Phoenix Knight gets bonus attack on hit
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) {
            hits++;
            // Extra roll on first hit
            if (!bonusRoll) {
              bonusRoll = true;
              let bonusR = floor(random(1,7));
              dR.push(bonusR);
              if (bonusR >= 3) hits++;
              specialAbilityText = " (Fencer Strike: bonus attack on hit)";
            }
          }
        }
      } else if (this.specialAbility.type === "FIRE_CHARGE" && this.hasMovedThisTurn) {
        // Fire Striker gets +1 attack if moved this turn
        for (let i=0; i<this.attackValue+1; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) hits++;
        }
        specialAbilityText = " (Fire Charge: +1 attack dice after moving)";
      } else if (this.specialAbility.type === "ORC_CHARGE" && this.hasMovedThisTurn) {
        // Tundra Orc gets +1 damage if moved this turn
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) hits++;
        }
        hits += 1;
        specialAbilityText = " (Orc Charge: +1 damage after moving)";
      } else if (this.specialAbility.type === "ICE_ARROWS") {
        // Winter Hunter reduces enemy attack value temporarily
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) hits++;
        }
        targetUnit.attackValue = Math.max(1, targetUnit.attackValue-1);
        specialAbilityText = " (Ice Arrows: target loses 1 attack dice)";
      } else if (this.specialAbility.type === "GIANT_STRENGTH") {
        // Frost Giant deals more damage with successful hits
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) {
            hits += 2; // Deal 2 damage per hit instead of 1
          }
        }
        specialAbilityText = " (Giant Strength: 2 damage per hit)";
      } else if (this.specialAbility.type === "GUARDIAN_SHIELD") {
        // Royal Guardian has better defense against single attacks
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) hits++;
        }
      } else {
        // Normal attack for units without attack-modifying abilities
        for (let i=0; i<this.attackValue; i++) {
          let r = floor(random(1,7));
          dR.push(r);
          if (r >= 3) hits++;
        }
      }
    } else {
      // Normal attack for units without special abilities
      for (let i=0; i<this.attackValue; i++) {
        let r = floor(random(1,7));
        dR.push(r);
        if (r >= 3) hits++;
      }
    }
    
    // Generate battle result text
    gameState.currentDiceRollResult = `${this.name}(${this.isPlayer1?'P1':'P2'}) attacks ${targetUnit.name}(${targetUnit.isPlayer1?'P1':'P2'})! Rolls:[${dR.join(',')}] -> ${hits} Hits${specialAbilityText}.`;
    gameState.battleResultDisplayTimer = CONFIG.BATTLE_RESULT_DISPLAY_TIME;
    
    // Apply damage
    targetUnit.takeDamage(hits);
    
    // Apply special abilities that happen after damage
    if (this.specialAbility && this.specialAbility.type === "MAMMOTH_RIDER" && hits >= 2) {
      // Mammoth Rider pushes target back 1 space if hits 2+ times
      this.pushUnit(targetUnit);
      specialAbilityText += " (Mammoth Push activated)";
      gameState.currentDiceRollResult = `${this.name}(${this.isPlayer1?'P1':'P2'}) attacks ${targetUnit.name}(${targetUnit.isPlayer1?'P1':'P2'})! Rolls:[${dR.join(',')}] -> ${hits} Hits${specialAbilityText}.`;
    }
    
    if (targetUnit.currentLifePoints <= 0 && !targetUnit.isDestroyed) {
      // Provide 1 mana when a unit is killed
      if (this.isPlayer1) gameState.player1Mana += 1; else gameState.player2Mana += 1;
      gameState.hasTargetedEnemyThisTurn = true; // An enemy was targeted and destroyed
      
      // Prince Elien ability: gain extra mana when killing an enemy (Mana Boost)
      if (this.specialAbility && this.specialAbility.type === "MANA_BOOST") {
        if (this.isPlayer1) gameState.player1Mana += 1; else gameState.player2Mana += 1;
        gameState.currentDiceRollResult += " Prince Elien gains bonus mana with Mana Boost!";
      }
      
      targetUnit.isDestroyed = true;
    }
    
    this.hasAttackedThisTurn = true;
    if (!gameState.unitsAttackedThisPhase.includes(this.id)) {
        gameState.unitsAttackedThisPhase.push(this.id);
    }
    if (targetUnit.isPlayer1 !== this.isPlayer1) {
        gameState.hasTargetedEnemyThisTurn = true; // An enemy was targeted
    }
    
    let aP = this.getPixelPos();
    let tP = targetUnit.getPixelPos();
    gameState.attackAnimations.push({
      attackerPos: aP,
      targetPos: tP,
      timer: CONFIG.BATTLE_RESULT_DISPLAY_TIME/3,
      duration: CONFIG.BATTLE_RESULT_DISPLAY_TIME/3
    });
    
    checkGameEndCondition();
    return true;
  }
  
  // Add push ability for Mammoth Rider
  pushUnit(targetUnit) {
    // Calculate push direction (away from the attacker)
    let dx = targetUnit.col - this.col;
    let dy = targetUnit.row - this.row;
    
    // Determine primary push direction
    if (Math.abs(dx) > Math.abs(dy)) {
      dx = dx > 0 ? 1 : -1;
      dy = 0;
    } else {
      dy = dy > 0 ? 1 : -1;
      dx = 0;
    }
    
    // New position after push
    let newRow = targetUnit.row + dy;
    let newCol = targetUnit.col + dx;
    
    // Check if new position is valid (on board and empty)
    if (isCellOnBoard(newRow, newCol) && !getUnitAt(newRow, newCol)) {
      targetUnit.row = newRow;
      targetUnit.col = newCol;
    }
  }
}

function populateAllAvailableCards(){
  // Define Phoenix Elves cards (2nd Edition based on new images)
  const phoenixElvesCards = [
    // Queen Maldaria is the summoner, not a drawable card
    new Card("Ember Archer", "Archer", 2, 2, 'ranged', 1, false, { type: "QUICK_SHOT" }),
    new Card("Ember Beast", "Brute", 3, 3, 'melee', 2, false, { type: "EMBER_BEAST_ABILITIES", born_of_fire: true, wildfire: true }),
    new Card("Ember Mage", "Archer", 2, 2, 'ranged', 1, false, { type: "GUARDED" }),
    new Card("Royal Guardian", "Guard", 1, 4, 'melee', 2, false, { type: "ROYAL_GUARDIAN_ABILITIES", engage: true, shove: true }),
    new Card("Fanessa", "Warrior", 3, 9, 'melee', 5, false, { type: "RIPOSTE" }),
    new Card("Fire Drake", "Brute", 4, 10, 'ranged', 8, false, { type: "FIRE_DRAKE_ABILITIES", protector: true, fire_breath: true }),
    new Card("Holleas", "Archer", 3, 7, 'ranged', 5, false, { type: "HOLLEAS_ABILITIES", fiery_summon: true, ignite: true }),
    // Phoenix Elves Event Cards
    new Card("Blinding Flare", "Event", null, null, null, 2, false, {
      type: "BLINDING_FLARE_EFFECT",
      phase: PHASES.MAGIC,
      active: true,
      text: "When your summoner or a friendly unit adjacent to your summoner is being attacked, add 1 damage to it for each shield rolled, instead of each sword or bow rolled."
    }),
    new Card("Burn", "Event", null, null, null, 1, false, {
      type: "BURN_EFFECT",
      phase: PHASES.MOVE,
      text: "Target a common or champion within 2 spaces of your summoner. Add 2 damage to the target."
    }),
    new Card("Divine Retribution", "Event", null, null, null, 3, false, {
      type: "DIVINE_RETRIBUTUTION_EFFECT",
      phase: PHASES.MAGIC,
      active: true,
      text: "Your summoner gains aura of the Phoenix: After this unit or a friendly unit within 3 spaces is attacked by an enemy unit, add 1 damage to that enemy."
    }),
    // Phoenix Elves Epic Event
    new Card("Spirit of the Phoenix", "Event", null, null, null, 0, false, {
      type: "SPIRIT_OF_THE_PHOENIX",
      phase: PHASES.SUMMON,
      active: true,
      text: "When the ability of a friendly unit adds damage to an enemy unit without attacking it, that ability adds 1 more damage."
    })
  ];
  
  // Define Tundra Orcs cards (2nd Edition)
  const tundraOrcsCards = [
    new Card("Grognack", "Summoner", 2, 7, 'melee', 0, true, { type: "FROST_ARMOR", text: "Frost Armor: This unit reduces damage by 1 to a minimum of 1." }),
    new Card("Tundra Orc", "Warrior", 2, 3, 'melee', 3, false, { type: "ORC_CHARGE" }),
    new Card("Ice Shaman", "Spearman", 1, 3, 'ranged', 3, false, { type: "ICE_STRIKE" }),
    new Card("Frost Giant", "Brute", 3, 5, 'melee', 5, false, { type: "GIANT_STRENGTH" }),
    new Card("Mammoth Rider", "Guard", 3, 6, 'melee', 6, false, { type: "MAMMOTH_RIDER" }),
    new Card("Winter Hunter", "Scout", 1, 2, 'ranged', 2, false, { type: "ICE_ARROWS" }),
  ];
  
  // Create faction-specific card pools
  const player1Cards = [...phoenixElvesCards];
  const player2Cards = [...tundraOrcsCards];
  
  // Combine all cards but ensure players only draw from their faction
  gameState.PHOENIX_ELF_CARDS = player1Cards;
  gameState.TUNDRA_ORC_CARDS = player2Cards;
  gameState.ALL_AVAILABLE_CARDS = [...phoenixElvesCards, ...tundraOrcsCards];
}
function initializeUnits(){
  gameState.units=[];
  // Player 1 uses Phoenix Elves with Queen Maldaria as summoner
  gameState.units.push(new Unit("Queen Maldaria",CONFIG.GRID_ROWS-1,floor(CONFIG.GRID_COLS/2)-1,true,4,9,'ranged',"Summoner",true, { type: "QUEEN_ABILITIES", call_protection: true, save_the_queen: true }));
  // Player 2 uses Tundra Orcs with Grognack as summoner
  gameState.units.push(new Unit("Grognack",0,floor(CONFIG.GRID_COLS/2)-1,false,2,7,'melee',"Summoner",true));
}
function drawNewCardForPlayer(isPlayer1){
  // Draw from faction-specific card pools
  const cardPool = isPlayer1 ? gameState.PHOENIX_ELF_CARDS : gameState.TUNDRA_ORC_CARDS;
  
  if(cardPool.length===0){
    console.log(`${isPlayer1 ? "Phoenix Elf" : "Tundra Orc"} deck is empty!`);
    return;
  }
  
  let cardTemplate = random(cardPool);
  let newDrawnCard = new Card(
    cardTemplate.unitName,
    cardTemplate.unitType,
    cardTemplate.attackValue,
    cardTemplate.lifePoints,
    cardTemplate.rangeType,
    cardTemplate.summonCost,
    cardTemplate.isSummonerCard,
    cardTemplate.specialAbility
  );
  
  if(isPlayer1)
    gameState.player1Hand.push(newDrawnCard);
  else
    gameState.player2Hand.push(newDrawnCard);
}
function initializeManaAndHands(){gameState.player1Mana=CONFIG.STARTING_MANA;gameState.player2Mana=CONFIG.STARTING_MANA;gameState.player1Hand=[];gameState.player2Hand=[];for(let i=0;i<CONFIG.INITIAL_HAND_SIZE;i++){drawNewCardForPlayer(true);drawNewCardForPlayer(false);}}
function setupGame(){populateAllAvailableCards();initializeUnits();initializeManaAndHands();gameState.currentPlayerIsP1=true;gameState.movesMadeThisTurn=0;gameState.attacksMadeThisTurn=0;gameState.unitsMovedThisPhase=[];gameState.unitsAttackedThisPhase=[];gameState.hasTargetedEnemyThisTurn=false;gameState.currentPhase=PHASE_ORDER[0];gameState.currentDiceRollResult="";gameState.gameOver=false;gameState.winnerMessage="";gameState.selectedUnit=null;gameState.selectedCardForSummoning=null;gameState.potentialMoveCells=[];gameState.potentialAttackCells=[];gameState.potentialSummonCells=[];gameState.attackAnimations=[];cardActionMenu.close();actionButtonRect.text=`End ${gameState.currentPhase} Phase`;}
function resetGame(){setupGame();}

function setup(){createCanvas(800,920);colorMode(HSB,360,100,100,100);cellWidth=width/CONFIG.GRID_COLS;cellHeight=(height-CONFIG.TOP_UI_SPACE-CONFIG.BOTTOM_UI_SPACE-CONFIG.HAND_CARD_HEIGHT-CONFIG.HAND_CARD_MARGIN)/CONFIG.GRID_ROWS;actionButtonRect={x:width-110,y:height-40,w:100,h:30,text:`End ${gameState.currentPhase} Phase`};setupGame();}

function drawGrid(){stroke(0,0,70);strokeWeight(1);let gridBottomY=height-CONFIG.HAND_CARD_HEIGHT-CONFIG.HAND_CARD_MARGIN-CONFIG.BOTTOM_UI_SPACE;for(let r=0;r<=CONFIG.GRID_ROWS;r++)line(0,CONFIG.TOP_UI_SPACE+r*cellHeight,width,CONFIG.TOP_UI_SPACE+r*cellHeight);for(let c=0;c<=CONFIG.GRID_COLS;c++)line(c*cellWidth,CONFIG.TOP_UI_SPACE,c*cellWidth,gridBottomY);stroke(0,0,50);strokeWeight(2);line(0,CONFIG.TOP_UI_SPACE+(gridBottomY-CONFIG.TOP_UI_SPACE)/2,width,CONFIG.TOP_UI_SPACE+(gridBottomY-CONFIG.TOP_UI_SPACE)/2);}
function drawHighlights(){if(gameState.gameOver)return;noStroke();fill(200,60,100,30);for(let cell of gameState.potentialMoveCells)rect(cell.col*cellWidth,CONFIG.TOP_UI_SPACE+cell.row*cellHeight,cellWidth,cellHeight);fill(120,70,90,40);for(let cell of gameState.potentialAttackCells)rect(cell.col*cellWidth,CONFIG.TOP_UI_SPACE+cell.row*cellHeight,cellWidth,cellHeight);fill(60,100,100,40);for(let cell of gameState.potentialSummonCells)rect(cell.col*cellWidth,CONFIG.TOP_UI_SPACE+cell.row*cellHeight,cellWidth,cellHeight);fill(240,80,80,40);for(let cell of gameState.potentialEventTargets)rect(cell.col*cellWidth,CONFIG.TOP_UI_SPACE+cell.row*cellHeight,cellWidth,cellHeight);}
function drawUnits(){for(let unit of gameState.units)unit.display();}
function drawAttackAnimations(){
  // Decrement battle result display timer if active
  if(gameState.battleResultDisplayTimer > 0) {
    gameState.battleResultDisplayTimer--;
    if(gameState.battleResultDisplayTimer <= 0) {
      gameState.currentDiceRollResult = "";
    }
  }
  
  // Handle attack animations
  for(let i=gameState.attackAnimations.length-1; i>=0; i--) {
    let anim=gameState.attackAnimations[i];
    anim.timer--;
    if(anim.timer<=0) {
      gameState.attackAnimations.splice(i,1);
    } else {
      push();
      let alpha=map(anim.timer,anim.duration,0,100,0);
      stroke(0,100,100,alpha);
      strokeWeight(3);
      line(anim.attackerPos.x,anim.attackerPos.y,anim.targetPos.x,anim.targetPos.y);
      pop();
    }
  }
}
function drawGameUI(){
  let topUiY=15;
  fill(0);
  textSize(14);
  
  if(!gameState.gameOver){
    // Draw player turn info on the left
    textAlign(LEFT,TOP);
    text(`Player ${gameState.currentPlayerIsP1?'1 (Blue)':'2 (Red)'}'s Turn. Phase: ${gameState.currentPhase}`,10,topUiY);
    // Display phase-specific action counts or general mana
    if (gameState.currentPhase === PHASES.MOVE) {
        text(`Units Moved: ${gameState.unitsMovedThisPhase.length}/3`, width/2-250, topUiY);
    } else if (gameState.currentPhase === PHASES.ATTACK) {
        text(`Units Attacked: ${gameState.unitsAttackedThisPhase.length}/3`, width/2-250, topUiY);
    }
    text(`Mana: ${gameState.currentPlayerIsP1?gameState.player1Mana:gameState.player2Mana}`,width/2-50,topUiY);
    
    // Draw battle results in top right with a background
    if(gameState.currentDiceRollResult && gameState.battleResultDisplayTimer > 0){
      let resultText = gameState.currentDiceRollResult;
      // No need to set text alignment here as we'll set it just before drawing the text
      
      // Calculate the box dimensions for the battle result display
      let textWidth = min(width * 0.4, 300);
      let textHeight = 40;
      let rightMargin = 20;
      let boxX = width - textWidth - rightMargin;
      let boxY = topUiY - 5;
      
      // Draw background for battle result
      push();
      fill(0, 0, 0, 15);
      stroke(0, 0, 0, 30);
      rect(boxX, boxY, textWidth, textHeight, 5);
      
      // Draw text with a subtle fade out as timer decreases
      let alpha = map(gameState.battleResultDisplayTimer, 0, CONFIG.BATTLE_RESULT_DISPLAY_TIME, 0, 100);
      fill(0, 0, 0, alpha);
      textSize(12);
      textAlign(LEFT, TOP);
      text(resultText, boxX + 10, boxY + 5, textWidth - 20, textHeight - 10);
      pop();
    }
  } else {
    // Game over message
    textAlign(CENTER,TOP);
    textSize(24);
    fill(0,80,100);
    text(gameState.winnerMessage,width/2,topUiY+10);
  }
  
  // Draw action button
  fill(gameState.gameOver?color(120,70,80):color(10,30,80));
  rect(actionButtonRect.x,actionButtonRect.y,actionButtonRect.w,actionButtonRect.h,5);
  fill(0);
  textAlign(CENTER,CENTER);
  textSize(14);
  text(actionButtonRect.text,actionButtonRect.x+actionButtonRect.w/2,actionButtonRect.y+actionButtonRect.h/2);
}
function drawPlayerHand(){
  if(gameState.gameOver) return;
  
  let currentHand = gameState.currentPlayerIsP1 ? gameState.player1Hand : gameState.player2Hand;
  let handStartX = 20;
  let handDisplayBaseY = height - CONFIG.HAND_CARD_HEIGHT - 5;
  
  for(let i=0; i<currentHand.length; i++){
    let card = currentHand[i];
    card.displayX = handStartX + i * (CONFIG.HAND_CARD_WIDTH + 10);
    card.displayY = handDisplayBaseY;
    card.displayWidth = CONFIG.HAND_CARD_WIDTH;
    card.displayHeight = CONFIG.HAND_CARD_HEIGHT;
    
    push();
    translate(card.displayX, card.displayY);
    strokeWeight(2);
    
    if(cardActionMenu.active && cardActionMenu.card && cardActionMenu.card.id === card.id)
      stroke(60, 100, 100);
    else if(gameState.selectedCardForSummoning && gameState.selectedCardForSummoning.id === card.id)
      stroke(60, 80, 100);
    else
      stroke(0, 0, 20);
    
    let currentMana = gameState.currentPlayerIsP1 ? gameState.player1Mana : gameState.player2Mana;
    if(card.summonCost > currentMana)
      fill(0, 0, 50, 70);
    else
      fill(45, 20, 95);
    
    rect(0, 0, card.displayWidth, card.displayHeight, 5);
    
    // Draw card content
    fill(0);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(12);
    text(card.unitName, card.displayWidth/2, 10);
    
    // Add special ability indicator and text if the card has one
    if(card.specialAbility) {
      fill(210, 100, 70);
      noStroke();
      textSize(8);
      
      let abilityName = "";
      switch(card.specialAbility.type) {
        case "MANA_BOOST": abilityName = "Mana Boost"; break;
        case "ACCURACY": abilityName = "Accuracy"; break;
        case "GUARDIAN_SHIELD": abilityName = "Guardian Shield"; break;
        case "FIRE_CHARGE": abilityName = "Fire Charge"; break;
        case "FIRE_BOMB": abilityName = "Fire Bomb"; break;
        case "FENCER_STRIKE": abilityName = "Fencer Strike"; break;
        case "FROST_ARMOR": abilityName = "Frost Armor"; break;
        case "ORC_CHARGE": abilityName = "Orc Charge"; break;
        case "ICE_STRIKE": abilityName = "Ice Strike"; break;
        case "GIANT_STRENGTH": abilityName = "Giant Strength"; break;
        case "MAMMOTH_RIDER": abilityName = "Mammoth Push"; break;
        case "ICE_ARROWS": abilityName = "Ice Arrows"; break;
      }
      
      text(abilityName, card.displayWidth/2, 25);
      
      // Star indicator for special ability
      fill(210, 100, 100);
      push();
      translate(card.displayWidth - 15, 15);
      drawStar(0, 0, 3, 7, 5);
      pop();
    }
    
    textSize(10);
    fill(0);
    text(`Cost: ${card.summonCost}`, card.displayWidth/2, card.displayHeight-25);
    text(`A:${card.attackValue} L:${card.lifePoints}`, card.displayWidth/2, card.displayHeight-12);
    
    pop();
  }

  // Draw tooltip for event cards
  for (let card of currentHand) {
    if (card.isMouseOver(mouseX, mouseY) && card.specialAbility && card.specialAbility.text) {
      const lines = card.specialAbility.text.split('\n');
      // Tooltip position
      let tx = mouseX + 10;
      let ty = mouseY + 10;
      // Tooltip box size
      const padding = 6;
      const lineHeight = 14;
      const w = max(...lines.map(l => textWidth(l))) + padding * 2;
      const h = lines.length * lineHeight + padding * 2;
      // Draw box
      push();
      fill(240, 80, 80);
      stroke(0);
      rect(tx, ty, w, h, 4);
      fill(0);
      textAlign(LEFT, TOP);
      textSize(12);
      // Draw each line
      for (let i = 0; i < lines.length; i++) {
        text(lines[i], tx + padding, ty + padding + i * lineHeight);
      }
      pop();
    }
  }
}

function draw(){background(60,10,95);gameState.units=gameState.units.filter(unit=>!unit.isDestroyed);drawGrid();if(!gameState.gameOver){for(let unit of gameState.units)unit.isHovered=unit.isMouseOver(mouseX,mouseY);drawHighlights();}drawUnits();drawAttackAnimations();drawGameUI();drawPlayerHand();cardActionMenu.draw();}

function pixelToGrid(mx,my){let gridAreaTop=CONFIG.TOP_UI_SPACE;let gridAreaBottom=height-CONFIG.HAND_CARD_HEIGHT-CONFIG.HAND_CARD_MARGIN-CONFIG.BOTTOM_UI_SPACE;if(my<gridAreaTop||my>gridAreaBottom)return null;let c=floor(mx/cellWidth);let r=floor((my-gridAreaTop)/cellHeight);if(r>=0&&r<CONFIG.GRID_ROWS&&c>=0&&c<CONFIG.GRID_COLS)return{row:r,col:c};return null;}
function getUnitAt(r,c){for(let unit of gameState.units){if(unit.row===r&&unit.col===c&&unit.currentLifePoints>0)return unit;}return null;}
function isCellOnBoard(r,c){return r>=0&&r<CONFIG.GRID_ROWS&&c>=0&&c<CONFIG.GRID_COLS;}
function deselectUnitSelections(){if(gameState.selectedUnit)gameState.selectedUnit.isSelected=false;gameState.selectedUnit=null;gameState.potentialMoveCells=[];gameState.potentialAttackCells=[];}
function deselectAllSelections(){deselectUnitSelections();gameState.selectedCardForSummoning=null;gameState.potentialSummonCells=[];gameState.selectedEventCard=null;gameState.potentialEventTargets=[];cardActionMenu.close();}
function selectUnitForAction(unit){deselectAllSelections();gameState.selectedUnit=unit;unit.isSelected=true;refreshPotentialUnitActions();}
function refreshPotentialUnitActions(){if(!gameState.selectedUnit)return;gameState.potentialMoveCells=gameState.selectedUnit.getValidMoveCells();gameState.potentialAttackCells=gameState.selectedUnit.getValidAttackCells();}
function calculatePotentialSummonCells(){gameState.potentialSummonCells=[];if(!gameState.selectedCardForSummoning)return;let summonerUnit=gameState.units.find(u=>u.isSummoner&&u.isPlayer1===gameState.currentPlayerIsP1&&u.currentLifePoints>0);if(!summonerUnit)return;const adjacents=[[-1,0],[1,0],[0,-1],[0,1]];for(let adj of adjacents){let r=summonerUnit.row+adj[0];let c=summonerUnit.col+adj[1];if(isCellOnBoard(r,c)&&!getUnitAt(r,c))gameState.potentialSummonCells.push({row:r,col:c});}}
function checkGameEndCondition(){let p1S=false;let p2S=false;for(let u of gameState.units){if(u.isSummoner){if(u.isPlayer1&&u.currentLifePoints>0)p1S=true;if(!u.isPlayer1&&u.currentLifePoints>0)p2S=true;}}if(!p1S){gameState.gameOver=true;gameState.winnerMessage="Game Over! Player 2 (Red) Wins!";actionButtonRect.text="Restart Game";deselectAllSelections();}else if(!p2S){gameState.gameOver=true;gameState.winnerMessage="Game Over! Player 1 (Blue) Wins!";actionButtonRect.text="Restart Game";deselectAllSelections();}}
function endTurn(){
  // Cost of Inaction: Add 1 damage to summoner if no enemy card was targeted during Attack Phase
  if (gameState.currentPhase === PHASES.ATTACK && !gameState.hasTargetedEnemyThisTurn) {
    let currentSummoner = gameState.units.find(u => u.isSummoner && u.isPlayer1 === gameState.currentPlayerIsP1);
    if (currentSummoner) {
      currentSummoner.takeDamage(1);
      gameState.currentDiceRollResult = `${currentSummoner.name} takes 1 damage (Cost of Inaction).`;
      gameState.battleResultDisplayTimer = CONFIG.BATTLE_RESULT_DISPLAY_TIME;
      checkGameEndCondition(); // Check if this damage ended the game
    }
  }

  // Reset for next phase or turn
  gameState.movesMadeThisTurn = 0; // Reset general counters, though phase-specific ones are more important now
  gameState.attacksMadeThisTurn = 0;
  gameState.unitsMovedThisPhase = [];
  gameState.unitsAttackedThisPhase = [];
  gameState.hasTargetedEnemyThisTurn = false;
  gameState.currentDiceRollResult = "";
  gameState.battleResultDisplayTimer = 0;

  for(let unit of gameState.units){
    unit.hasMovedThisTurn = false; // This flag is now per-unit, per-phase for movement
    unit.hasAttackedThisTurn = false; // This flag is now per-unit, per-phase for attack
    if (unit.attackValue !== unit.originalAttackValue) {
      unit.attackValue = unit.originalAttackValue;
    }
  }
  deselectAllSelections();

  // Determine next phase or next player
  let currentPhaseIndex = PHASE_ORDER.indexOf(gameState.currentPhase);
  if (currentPhaseIndex === PHASE_ORDER.length - 1) { // If it was the Draw phase (last phase)
    gameState.currentPlayerIsP1 = !gameState.currentPlayerIsP1;
    gameState.currentPhase = PHASE_ORDER[0]; // Start with Summon phase for the next player
    // Draw phase action (draw up to 5) happens before switching player in this new structure
    let currentHand = gameState.currentPlayerIsP1 ? gameState.player1Hand : gameState.player2Hand; // Hand of the player whose turn just ended
    const cardsToDraw = 5 - currentHand.length;
    if (cardsToDraw > 0) {
        for (let i = 0; i < cardsToDraw; i++) {
            drawNewCardForPlayer(!gameState.currentPlayerIsP1); // Draw for the player whose turn it was
        }
    }
  } else {
    gameState.currentPhase = PHASE_ORDER[currentPhaseIndex + 1];
  }
  
  actionButtonRect.text = `End ${gameState.currentPhase} Phase`;

  // Specific phase start logic
  if (gameState.currentPhase === PHASES.DRAW && currentPhaseIndex !== PHASE_ORDER.length -1 ) {
    // This case should not be hit if logic is correct, draw happens at end of player's turn before switching
  } else if (gameState.currentPhase === PHASES.SUMMON) {
    // Reset per-turn summon limits if any
  } else if (gameState.currentPhase === PHASES.MOVE) {
    // Reset unit.hasMovedThisTurn for all units of the current player
     for(let unit of gameState.units){
        if(unit.isPlayer1 === gameState.currentPlayerIsP1){
            unit.hasMovedThisTurn = false;
        }
    }
  } else if (gameState.currentPhase === PHASES.ATTACK) {
    // Reset unit.hasAttackedThisTurn for all units of the current player
    for(let unit of gameState.units){
        if(unit.isPlayer1 === gameState.currentPlayerIsP1){
            unit.hasAttackedThisTurn = false;
        }
    }
  }
}

function isMouseOverRect(mx,my,rect){return mx>rect.x&&mx<rect.x+rect.w&&my>rect.y&&my<rect.y+rect.h;}

function handleActionButtonClick(){if(gameState.gameOver)resetGame();else endTurn();}

function handleHandCardClick(mx,my){if(gameState.gameOver)return false;let currentHand=gameState.currentPlayerIsP1?gameState.player1Hand:gameState.player2Hand;for(let i=0;i<currentHand.length;i++){let card=currentHand[i];if(card.isMouseOver(mx,my)){if(cardActionMenu.active&&cardActionMenu.card&&cardActionMenu.card.id===card.id){/* Already open for this card, do nothing or close? For now, nothing. */}else if(gameState.selectedCardForSummoning&&gameState.selectedCardForSummoning.id===card.id){deselectAllSelections(); // Clicking selected card again deselects it and closes menu
cardActionMenu.open(card,i,card.displayX,card.displayY,card.displayWidth,card.displayHeight);}else{deselectAllSelections();cardActionMenu.open(card,i,card.displayX,card.displayY,card.displayWidth,card.displayHeight);}return true;}}return false;}

function handleGridClick(mx,my,gridPos){
    // If an event card is selected for targeting
    if (gameState.selectedEventCard) {
        // Burn effect target
        if (gameState.selectedEventCard.specialAbility.type === "BURN_EFFECT") {
            for (let cell of gameState.potentialEventTargets) {
                if (cell.row === gridPos.row && cell.col === gridPos.col) {
                    const target = getUnitAt(gridPos.row, gridPos.col);
                    if (target) {
                        target.takeDamage(2);
                    }
                    // Clear event selection
                    gameState.selectedEventCard = null;
                    gameState.potentialEventTargets = [];
                    return true;
                }
            }
        }
    }

    let clickedUnitInstance=getUnitAt(gridPos.row,gridPos.col);if(gameState.selectedCardForSummoning){if (gameState.currentPhase === PHASES.SUMMON || gameState.currentPhase === PHASES.BUILD) { // Allow summoning/building in respective phases
let placed=false;for(let cell of gameState.potentialSummonCells){if(cell.row===gridPos.row&&cell.col===gridPos.col){let newUnit=gameState.selectedCardForSummoning.createUnit(gridPos.row,gridPos.col,gameState.currentPlayerIsP1);if(newUnit){ // createUnit returns null for Event cards
gameState.units.push(newUnit);if(gameState.currentPlayerIsP1)gameState.player1Mana-=gameState.selectedCardForSummoning.summonCost;else gameState.player2Mana-=gameState.selectedCardForSummoning.summonCost;if(gameState.currentPlayerIsP1)gameState.player1Hand=gameState.player1Hand.filter(c=>c.id!==gameState.selectedCardForSummoning.id);else gameState.player2Hand=gameState.player2Hand.filter(c=>c.id!==gameState.selectedCardForSummoning.id);placed=true;break;}}else{console.log("Cannot play event card by clicking grid. Event cards are played from hand menu.");}}deselectAllSelections();return true;}} else if(gameState.selectedUnit){let actionPerformed=false;if(gameState.currentPhase === PHASES.MOVE && gameState.selectedUnit.canMoveNow() && gameState.unitsMovedThisPhase.length < 3 && !gameState.unitsMovedThisPhase.includes(gameState.selectedUnit.id)){for(let mC of gameState.potentialMoveCells){if(mC.row===gridPos.row&&mC.col===gridPos.col){gameState.selectedUnit.moveTo(gridPos.row,gridPos.col);actionPerformed=true;break;}}}if(!actionPerformed && gameState.currentPhase === PHASES.ATTACK && gameState.selectedUnit.canAttackNow() && gameState.unitsAttackedThisPhase.length < 3 && !gameState.unitsAttackedThisPhase.includes(gameState.selectedUnit.id)){for(let aC of gameState.potentialAttackCells){if(aC.row===gridPos.row&&aC.col===gridPos.col){let tU=getUnitAt(aC.row,aC.col);if(tU&&tU.isPlayer1!==gameState.selectedUnit.isPlayer1){gameState.selectedUnit.attack(tU);actionPerformed=true;}break;}}}if(actionPerformed){let canStillAct = false;if (gameState.currentPhase === PHASES.MOVE && gameState.selectedUnit.canMoveNow() && gameState.unitsMovedThisPhase.length < 3 && !gameState.unitsMovedThisPhase.includes(gameState.selectedUnit.id)) {canStillAct = true;}if (gameState.currentPhase === PHASES.ATTACK && gameState.selectedUnit.canAttackNow() && gameState.unitsAttackedThisPhase.length < 3 && !gameState.unitsAttackedThisPhase.includes(gameState.selectedUnit.id)) {canStillAct = true;}if(!canStillAct) deselectAllSelections();else refreshPotentialUnitActions();}else{if(clickedUnitInstance&&clickedUnitInstance.isPlayer1===gameState.currentPlayerIsP1)selectUnitForAction(clickedUnitInstance);else deselectAllSelections();}return true;}else{if(clickedUnitInstance&&clickedUnitInstance.isPlayer1===gameState.currentPlayerIsP1){if((gameState.currentPhase === PHASES.MOVE && clickedUnitInstance.canMoveNow() && gameState.unitsMovedThisPhase.length < 3 && !gameState.unitsMovedThisPhase.includes(clickedUnitInstance.id)) || (gameState.currentPhase === PHASES.ATTACK && clickedUnitInstance.canAttackNow() && gameState.unitsAttackedThisPhase.length < 3 && !gameState.unitsAttackedThisPhase.includes(clickedUnitInstance.id)))selectUnitForAction(clickedUnitInstance);}else{deselectAllSelections();}return true;}}

function mousePressed(){if(mouseButton!==LEFT)return;if(isMouseOverRect(mouseX,mouseY,actionButtonRect)){handleActionButtonClick();return;}if(gameState.gameOver)return;if(cardActionMenu.active){if(cardActionMenu.handleMousePress(mouseX,mouseY))return;}if(handleHandCardClick(mouseX,mouseY))return;let gridPos=pixelToGrid(mouseX,mouseY);if(gridPos){handleGridClick(mouseX,mouseY,gridPos);return;}if(!cardActionMenu.active && !isMouseOverRect(mouseX, mouseY, cardActionMenu.playButtonRect) && !isMouseOverRect(mouseX, mouseY, cardActionMenu.scrapButtonRect)){ // Ensure not clicking menu buttons
    deselectAllSelections();
}}

function windowResized(){/* Not dynamically used */}

// Helper function to draw a star for ability indicators
function drawStar(x, y, innerRadius, outerRadius, points) {
  let angle = TWO_PI / points;
  let halfAngle = angle / 2.0;
  beginShape();
  for (let a = 0; a < TWO_PI; a += angle) {
    let sx = x + cos(a) * outerRadius;
    let sy = y + sin(a) * outerRadius;
    vertex(sx, sy);
    sx = x + cos(a + halfAngle) * innerRadius;
    sy = y + sin(a + halfAngle) * innerRadius;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}
