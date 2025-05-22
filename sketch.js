
let GRID_ROWS = 6;
let GRID_COLS = 8;
let cellWidth, cellHeight;
let units = [];
let selectedUnit = null;
let potentialMoveCells = [];
let potentialAttackCells = [];
let attackAnimations = [];
let currentPlayerIsP1 = true;
let movesMadeThisTurn = 0;
let attacksMadeThisTurn = 0;
const MAX_MOVES_PER_TURN_PLAYER = 3;
const MAX_ATTACKS_PER_TURN_PLAYER = 3;
let currentDiceRollResult = "";

let actionButton;
let gameOver = false;
let winnerMessage = "";

// --- New for Summoning & Mana ---
let player1Mana = 0;
let player2Mana = 0;
const STARTING_MANA = 5;

class Card {
    constructor(unitName, unitType, attackValue, lifePoints, rangeType, summonCost, isSummonerCard = false) {
        this.unitName = unitName; // e.g., "P1 Spearman"
        this.unitType = unitType; // e.g., "Spearman" for visuals
        this.attackValue = attackValue;
        this.lifePoints = lifePoints;
        this.rangeType = rangeType;
        this.summonCost = summonCost;
        this.isSummonerCard = isSummonerCard;
        this.id = unitName + "_" + summonCost + "_" + Math.random().toString(16).slice(9);

        // For display in hand
        this.displayX = 0; this.displayY = 0; this.displayWidth = 0; this.displayHeight = 0;
    }

    createUnit(row, col, isPlayer1) {
        return new Unit(this.unitName, row, col, isPlayer1,
                        this.attackValue, this.lifePoints, this.rangeType,
                        this.unitType, this.isSummonerCard);
    }

    isMouseOver(mx, my) {
        return mx > this.displayX && mx < this.displayX + this.displayWidth &&
               my > this.displayY && my < this.displayY + this.displayHeight;
    }
}

let player1Hand = [];
let player2Hand = [];
let selectedCardForSummoning = null;
let potentialSummonCells = [];

const HAND_CARD_WIDTH = 80;
const HAND_CARD_HEIGHT = 100;
const HAND_Y_OFFSET = 60; // From bottom of screen


// Unit class
class Unit {
  constructor(name, r, c, isPlayer1, attackValue, lifePoints, rangeType, type, isSummoner = false) {
    this.name = name;
    this.row = r; this.col = c;
    this.isPlayer1 = isPlayer1;
    this.attackValue = attackValue;
    this.maxLifePoints = lifePoints; this.currentLifePoints = lifePoints;
    this.rangeType = rangeType; this.attackRange = (rangeType === 'melee') ? 1 : 3;
    this.moveRange = 2;
    this.type = type; this.isSummoner = isSummoner;
    this.color = isPlayer1 ? color(240, 80, 90) : color(0, 80, 90);
    this.id = name + "_" + r + "_" + c + (isPlayer1 ? "_P1" : "_P2") + Math.random().toString(16).slice(5);
    this.isSelected = false; this.hasMovedThisTurn = false; this.hasAttackedThisTurn = false;
    this.isHovered = false; this.size = 0;
    this.isDestroyed = false; // For marking units to be removed
  }

  getPixelPos() { /* ... (no changes) ... */ 
    return {
      x: this.col * cellWidth + cellWidth / 2,
      y: this.row * cellHeight + cellHeight / 2,
    };
  }
  display() { /* ... (no changes from visual update) ... */
    let pos = this.getPixelPos();
    this.size = min(cellWidth, cellHeight) * 0.60; // Base size for visuals
    push();
    translate(pos.x, pos.y);

    let currentSat = saturation(this.color);
    let currentBri = brightness(this.color);

    if ((this.hasMovedThisTurn || this.hasAttackedThisTurn) && this.currentLifePoints > 0 && !gameOver) {
      currentSat *= 0.6;
      currentBri *= 0.9;
    }

    if (this.isHovered && this.currentLifePoints > 0 && !gameOver) {
      stroke(50, 100, 100);
      strokeWeight(3);
    } else {
      noStroke();
    }

    if (this.isSelected && this.currentLifePoints > 0 && !gameOver) {
      fill(hue(this.color), currentSat, currentBri + 10, 50);
      ellipse(0, 0, this.size * 1.5, this.size * 1.5); 
      stroke(0, 0, 100);
      strokeWeight(2);
    }

    noStroke();
    if (this.currentLifePoints <= 0) {
      fill(0, 0, 30); 
      ellipse(0, 0, this.size, this.size);
    } else {
      fill(hue(this.color), currentSat, currentBri);
      switch (this.type) {
        case "Summoner":
          ellipse(0, 0, this.size, this.size);
          fill(60, 100, 100); 
          triangle(-this.size * 0.2, -this.size * 0.4, this.size * 0.2, -this.size * 0.4, 0, -this.size * 0.6);
          ellipse(0, -this.size * 0.5, this.size * 0.1, this.size * 0.1);
          break;
        case "Archer":
          noFill(); stroke(hue(this.color), currentSat*0.7, currentBri*0.7); strokeWeight(3);
          arc(0, 0, this.size, this.size, PI + HALF_PI*0.5, HALF_PI*0.5 );
          stroke(0,0,50); line(0, -this.size * 0.3, 0, this.size * 0.3);
          fill(0,0,50); triangle(-this.size*0.1, this.size*0.2, this.size*0.1, this.size*0.2, 0, this.size*0.4);
          noStroke(); fill(hue(this.color), currentSat, currentBri); 
          ellipse(0,0, this.size * 0.3, this.size * 0.4);
          break;
        case "Warrior":
          rectMode(CENTER); rect(0, 0, this.size * 0.8, this.size, this.size * 0.2); rectMode(CORNER);
          break;
        case "Spearman":
          stroke(0,0,50); strokeWeight(3); line(0, -this.size * 0.5, 0, this.size * 0.3);
          fill(0,0,60); triangle(-this.size*0.1, -this.size*0.4, this.size*0.1, -this.size*0.4, 0, -this.size*0.6);
          noStroke(); fill(hue(this.color), currentSat, currentBri); 
          ellipse(0, this.size * 0.2, this.size * 0.4, this.size * 0.5);
          break;
        case "Brute":
          rectMode(CENTER); rect(0, 0, this.size, this.size * 0.8, this.size * 0.1); rectMode(CORNER);
          break;
        default: ellipse(0, 0, this.size, this.size); 
      }
    }
    noStroke(); 

    fill(0); textAlign(CENTER, BOTTOM); textSize(min(cellWidth / 5, 11));
    text(this.name, 0, -this.size * 0.5 - (this.type === "Summoner" ? 10 : 5));

    if (this.currentLifePoints > 0) {
      fill(0, 0, 20); rect(-this.size * 0.4, this.size * 0.5, this.size * 0.8, 8, 2);
      fill(120, 100, 80); 
      let hpWidth = map(this.currentLifePoints, 0, this.maxLifePoints, 0, this.size * 0.8);
      rect(-this.size * 0.4, this.size * 0.5, hpWidth, 8, 2);
      fill(0); textAlign(CENTER, CENTER); textSize(10);
      text(`${this.currentLifePoints}`, 0, this.size * 0.5 + 4);
    } else {
      fill(0, 0, 100); textAlign(CENTER, CENTER); textSize(this.size * 0.6);
      text("X", 0, 0);
    }
    pop();
  }
  isMouseOver(mx, my) { /* ... (no changes) ... */ 
    let pos = this.getPixelPos();
    let d = dist(mx, my, pos.x, pos.y);
    return d < this.size / 2 * 1.2;
  }
  takeDamage(amount) { this.currentLifePoints -= amount; if (this.currentLifePoints < 0) this.currentLifePoints = 0; }
  canMoveNow() { return this.currentLifePoints > 0 && !this.hasMovedThisTurn && movesMadeThisTurn < MAX_MOVES_PER_TURN_PLAYER; }
  canAttackNow() { return this.currentLifePoints > 0 && !this.hasAttackedThisTurn && attacksMadeThisTurn < MAX_ATTACKS_PER_TURN_PLAYER; }
  getValidMoveCells(allUnits) { /* ... (no changes) ... */ 
    let possibleMoves = []; if (!this.canMoveNow()) return possibleMoves;
    let q = [{ r: this.row, c: this.col, steps: 0 }]; let visited = new Set([`${this.row},${this.col}`]);
    while (q.length > 0) {
      let curr = q.shift();
      if (curr.steps > 0 && !getUnitAt(curr.r, curr.c, allUnits)) possibleMoves.push({ row: curr.r, col: curr.c });
      if (curr.steps < this.moveRange) {
        let adjs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let adj of adjs) {
          let nextR = curr.r + adj[0]; let nextC = curr.c + adj[1]; let nextKey = `${nextR},${nextC}`;
          if (isCellOnBoard(nextR, nextC) && !visited.has(nextKey)) {
            if (!getUnitAt(nextR, nextC, allUnits)) { visited.add(nextKey); q.push({ r: nextR, c: nextC, steps: curr.steps + 1 }); }
          }
        }
      }
    } return possibleMoves;
  }
  getValidAttackCells(allUnits) { /* ... (no changes) ... */ 
    let targets = []; if (!this.canAttackNow()) return targets;
    if (this.rangeType === 'melee') {
      const adjacents = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (let adj of adjacents) {
        let r = this.row + adj[0]; let c = this.col + adj[1];
        if (isCellOnBoard(r, c)) {
          let unitInCell = getUnitAt(r, c, allUnits);
          if (unitInCell && unitInCell.isPlayer1 !== this.isPlayer1 && unitInCell.currentLifePoints > 0) targets.push({ row: r, col: c });
        }
      }
    } else if (this.rangeType === 'ranged') {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (let dir of directions) {
        for (let d = 1; d <= this.attackRange; d++) {
          let r = this.row + dir[0] * d; let c = this.col + dir[1] * d;
          if (!isCellOnBoard(r, c)) break;
          let unitInCell = getUnitAt(r, c, allUnits);
          if (unitInCell) {
            if (unitInCell.isPlayer1 !== this.isPlayer1 && unitInCell.currentLifePoints > 0) targets.push({ row: r, col: c });
            break;
          }
        }
      }
    } return targets;
  }
  moveTo(r, c) { this.row = r; this.col = c; this.hasMovedThisTurn = true; movesMadeThisTurn++; }

  attack(targetUnit) {
    let hits = 0; let diceRolls = [];
    for (let i = 0; i < this.attackValue; i++) { let roll = floor(random(1, 7)); diceRolls.push(roll); if (roll >= 3) hits++; }
    
    currentDiceRollResult = `${this.name} (${this.isPlayer1 ? 'P1':'P2'}) attacks ${targetUnit.name} (${targetUnit.isPlayer1 ? 'P1':'P2'})! Rolls: [${diceRolls.join(',')}] -> ${hits} Hits.`;
    targetUnit.takeDamage(hits);
    
    if (targetUnit.currentLifePoints <= 0 && !targetUnit.isDestroyed) { // Ensure mana is awarded only once
        let manaGained = Math.floor(targetUnit.maxLifePoints / 2);
        if (this.isPlayer1) player1Mana += manaGained;
        else player2Mana += manaGained;
        console.log(`Player ${this.isPlayer1 ? 1 : 2} gained ${manaGained} mana for destroying ${targetUnit.name}`);
        targetUnit.isDestroyed = true; // Mark for removal
    }

    this.hasAttackedThisTurn = true; attacksMadeThisTurn++;
    let attackerPos = this.getPixelPos(); let targetPos = targetUnit.getPixelPos();
    attackAnimations.push({ attackerPos, targetPos, timer: 60, duration: 60 });
    checkGameEnd();
    return true;
  }
}

function initializeUnits() {
    units = [];
    units.push(new Unit("Summoner", GRID_ROWS - 1, floor(GRID_COLS / 2) - 1, true, 2, 6, 'melee', "Summoner", true));
    units.push(new Unit("SumP2", 0, floor(GRID_COLS / 2) - 1, false, 2, 6, 'melee', "Summoner", true));
    // Other starting units could be added here or summoned
}

function initializeManaAndHands() {
    player1Mana = STARTING_MANA;
    player2Mana = STARTING_MANA;
    player1Hand = [
        new Card("Archer", "Archer", 1, 3, 'ranged', 3),
        new Card("Warrior", "Warrior", 3, 4, 'melee', 4)
    ];
    player2Hand = [
        new Card("Spearman", "Spearman", 2, 3, 'ranged', 3),
        new Card("Brute", "Brute", 3, 5, 'melee', 5)
    ];
}

function setup() {
  createCanvas(800, 700); // Increased height for hand
  colorMode(HSB, 360, 100, 100, 100);
  cellWidth = width / GRID_COLS;
  cellHeight = (height - HAND_Y_OFFSET - 50) / GRID_ROWS; // Adjusted for hand and bottom UI
  
  initializeUnits();
  initializeManaAndHands();
  
  actionButton = { x: width - 110, y: height - 40, w: 100, h: 30, text: "End Turn" };
}

function resetGame() {
    initializeUnits();
    initializeManaAndHands();
    currentPlayerIsP1 = true; movesMadeThisTurn = 0; attacksMadeThisTurn = 0;
    currentDiceRollResult = ""; gameOver = false; winnerMessage = "";
    selectedUnit = null; potentialMoveCells = []; potentialAttackCells = [];
    attackAnimations = [];
    selectedCardForSummoning = null; potentialSummonCells = [];
    actionButton.text = "End Turn";
}


function draw() {
  background(60, 10, 95);
  units = units.filter(unit => !unit.isDestroyed); // Remove destroyed units
  drawGrid();

  if (!gameOver) {
    for (let unit of units) unit.isHovered = unit.isMouseOver(mouseX, mouseY);

    fill(200, 60, 100, 30); noStroke(); // Move cells: Light Blue
    for (let cell of potentialMoveCells) rect(cell.col * cellWidth, cell.row * cellHeight, cellWidth, cellHeight);
    
    fill(120, 70, 90, 40); noStroke(); // Attack cells: Light Green
    for (let cell of potentialAttackCells) rect(cell.col * cellWidth, cell.row * cellHeight, cellWidth, cellHeight);

    fill(255, 255, 0, 50); noStroke(); // Summon cells: Light Yellow
    for (let cell of potentialSummonCells) rect(cell.col * cellWidth, cell.row * cellHeight, cellWidth, cellHeight);
  }

  for (let unit of units) unit.display();
  
  for (let i = attackAnimations.length - 1; i >= 0; i--) { /* ... (animation drawing, no change) ... */ 
    let anim = attackAnimations[i]; anim.timer--;
    if (anim.timer <= 0) { attackAnimations.splice(i, 1); if (attackAnimations.length === 0) currentDiceRollResult = ""; } 
    else { push(); let alpha = map(anim.timer, anim.duration, 0, 100, 0); stroke(0, 100, 100, alpha); strokeWeight(3); line(anim.attackerPos.x, anim.attackerPos.y, anim.targetPos.x, anim.targetPos.y); pop(); }
  }

  drawUI();
  drawHand();
}

function drawUI() {
    let uiTextY = height - 40; // Bottom UI area
    fill(0); textSize(14); textAlign(LEFT, TOP);

    if (!gameOver) {
        let turnText = `Player ${currentPlayerIsP1 ? '1 (Blue)' : '2 (Red)'}'s Turn. Moves: ${movesMadeThisTurn}/${MAX_MOVES_PER_TURN_PLAYER}. Attacks: ${attacksMadeThisTurn}/${MAX_ATTACKS_PER_TURN_PLAYER}`;
        text(turnText, 10, uiTextY + 8);
        let manaText = `Mana: ${currentPlayerIsP1 ? player1Mana : player2Mana}`;
        text(manaText, width / 2, uiTextY + 8);
    } else {
        textAlign(CENTER, TOP); textSize(24); fill(0, 80, 100);
        text(winnerMessage, width / 2, uiTextY - 30);
    }
    
    textAlign(CENTER, TOP);
    if (currentDiceRollResult && !gameOver) text(currentDiceRollResult, width/2, uiTextY - 10);
    
    fill(gameOver ? color(120, 70, 80) : color(10, 30, 80));
    rect(actionButton.x, actionButton.y, actionButton.w, actionButton.h, 5);
    fill(0); textAlign(CENTER, CENTER); textSize(14);
    text(actionButton.text, actionButton.x + actionButton.w/2, actionButton.y + actionButton.h/2);
}

function drawHand() {
    if (gameOver) return;
    let currentHand = currentPlayerIsP1 ? player1Hand : player2Hand;
    let handStartX = 20;
    let handDisplayY = height - HAND_Y_OFFSET - HAND_CARD_HEIGHT / 2 + 20; // Centered in its zone

    for (let i = 0; i < currentHand.length; i++) {
        let card = currentHand[i];
        card.displayX = handStartX + i * (HAND_CARD_WIDTH + 10);
        card.displayY = handDisplayY - HAND_CARD_HEIGHT / 2;
        card.displayWidth = HAND_CARD_WIDTH;
        card.displayHeight = HAND_CARD_HEIGHT;

        push();
        translate(card.displayX, card.displayY);
        strokeWeight(2);
        if (selectedCardForSummoning && selectedCardForSummoning.id === card.id) {
            stroke(255, 255, 0); // Yellow highlight for selected card
        } else {
            stroke(0,0,20); // Dark border
        }
        
        let currentMana = currentPlayerIsP1 ? player1Mana : player2Mana;
        if (card.summonCost > currentMana) {
            fill(0,0,50, 70); // Greyed out if too expensive
        } else {
            fill(45, 20, 95); // Light card background
        }
        rect(0, 0, card.displayWidth, card.displayHeight, 5);

        fill(0); // Black text
        noStroke();
        textAlign(CENTER, TOP);
        textSize(12);
        text(card.unitName, card.displayWidth / 2, 10);
        textSize(10);
        text(`Cost: ${card.summonCost}`, card.displayWidth / 2, card.displayHeight - 25);
        text(`A:${card.attackValue} L:${card.lifePoints}`, card.displayWidth / 2, card.displayHeight - 12);
        pop();
    }
}


function drawGrid() { /* ... (no changes) ... */ 
  stroke(0, 0, 70); strokeWeight(1);
  for (let r = 0; r < GRID_ROWS; r++) line(0, r * cellHeight, width, r * cellHeight);
  for (let c = 0; c < GRID_COLS; c++) line(c * cellWidth, 0, c * cellWidth, height - HAND_Y_OFFSET - 50); // Adjusted grid height
  stroke(0,0,50); strokeWeight(2);
  line(0, (height - HAND_Y_OFFSET - 50)/2, width, (height - HAND_Y_OFFSET - 50)/2);
}
function pixelToGrid(mx, my) {
  if (my > height - HAND_Y_OFFSET - 50) return null; // In hand or bottom UI area
  let c = floor(mx / cellWidth); let r = floor(my / cellHeight);
  if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) return { row: r, col: c };
  return null;
}
function getUnitAt(r, c, allUnits) { /* ... (no changes) ... */ 
  for (let unit of allUnits) { if (unit.row === r && unit.col === c && unit.currentLifePoints > 0) return unit; } return null;
}
function isCellOnBoard(r, c) { /* ... (no changes) ... */ 
  return r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS;
}

function deselectAll() {
    if (selectedUnit) selectedUnit.isSelected = false;
    selectedUnit = null;
    selectedCardForSummoning = null;
    potentialMoveCells = [];
    potentialAttackCells = [];
    potentialSummonCells = [];
}
function selectUnitForAction(unit) {
    deselectAll(); 
    selectedUnit = unit;
    selectedUnit.isSelected = true;
    refreshPotentialActions();
}
function refreshPotentialActions() {
    if (!selectedUnit) return;
    potentialMoveCells = selectedUnit.getValidMoveCells(units);
    potentialAttackCells = selectedUnit.getValidAttackCells(units);
}

function calculatePotentialSummonCells() {
    potentialSummonCells = [];
    if (!selectedCardForSummoning) return;

    let summonerUnit = units.find(u => u.isSummoner && u.isPlayer1 === currentPlayerIsP1 && u.currentLifePoints > 0);
    if (!summonerUnit) return; // No summoner, no summoning next to it

    const adjacents = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let adj of adjacents) {
        let r = summonerUnit.row + adj[0];
        let c = summonerUnit.col + adj[1];

        // Check if on player's side (optional, simple rule for now)
        let onPlayerSide = currentPlayerIsP1 ? (r >= GRID_ROWS / 2) : (r < GRID_ROWS / 2);
        onPlayerSide = true; // For now, allow anywhere adjacent to summoner if empty

        if (isCellOnBoard(r, c) && !getUnitAt(r, c, units) && onPlayerSide) {
            potentialSummonCells.push({ row: r, col: c });
        }
    }
}

function checkGameEnd() { /* ... (no changes) ... */
    let p1SummonerAlive = false; let p2SummonerAlive = false;
    for (let unit of units) {
        if (unit.isSummoner) {
            if (unit.isPlayer1 && unit.currentLifePoints > 0) p1SummonerAlive = true;
            if (!unit.isPlayer1 && unit.currentLifePoints > 0) p2SummonerAlive = true;
        }
    }
    if (!p1SummonerAlive) { gameOver = true; winnerMessage = "Game Over! Player 2 (Red) Wins!"; actionButton.text = "Restart Game"; deselectAll(); }
    else if (!p2SummonerAlive) { gameOver = true; winnerMessage = "Game Over! Player 1 (Blue) Wins!"; actionButton.text = "Restart Game"; deselectAll(); }
}

function mousePressed() {
  if (mouseButton !== LEFT) return;

  if (mouseX > actionButton.x && mouseX < actionButton.x + actionButton.w && mouseY > actionButton.y && mouseY < actionButton.y + actionButton.h) {
    if (gameOver) resetGame(); else endTurn();
    return;
  }

  if (gameOver) return;

  // --- Check for hand card clicks ---
  let currentHand = currentPlayerIsP1 ? player1Hand : player2Hand;
  let clickedOnCard = false;
  for (let card of currentHand) {
      if (card.isMouseOver(mouseX, mouseY)) {
          let currentMana = currentPlayerIsP1 ? player1Mana : player2Mana;
          if (card.summonCost <= currentMana) {
              deselectAll();
              selectedCardForSummoning = card;
              calculatePotentialSummonCells();
          } else {
              console.log("Not enough mana to select this card for summoning.");
              deselectAll(); // Deselect even if can't afford, to clear previous state
          }
          clickedOnCard = true;
          break;
      }
  }
  if (clickedOnCard) return; // Click was processed as a card click

  // --- Process grid clicks (move, attack, summon placement) ---
  let gridPos = pixelToGrid(mouseX, mouseY);
  if (!gridPos) { if(!isMouseOverActionButton()) deselectAll(); return; }

  let clickedUnitInstance = getUnitAt(gridPos.row, gridPos.col, units);

  if (selectedCardForSummoning) { // --- Attempting to place a summoned unit ---
      let placed = false;
      for (let cell of potentialSummonCells) {
          if (cell.row === gridPos.row && cell.col === gridPos.col) {
              let newUnit = selectedCardForSummoning.createUnit(gridPos.row, gridPos.col, currentPlayerIsP1);
              units.push(newUnit);
              if (currentPlayerIsP1) player1Mana -= selectedCardForSummoning.summonCost;
              else player2Mana -= selectedCardForSummoning.summonCost;
              
              // Remove card from hand
              if (currentPlayerIsP1) player1Hand = player1Hand.filter(c => c.id !== selectedCardForSummoning.id);
              else player2Hand = player2Hand.filter(c => c.id !== selectedCardForSummoning.id);
              
              placed = true;
              break;
          }
      }
      deselectAll(); // Always deselect after a summon attempt (success or clicking elsewhere)
      if(placed) return; // Successfully placed, action done.
      // If not placed and clicked elsewhere on grid, fall through to unit selection/action
  }
  
  // --- Standard unit selection and action ---
  if (selectedUnit) {
    let actionPerformed = false;
    if (selectedUnit.canMoveNow()) {
      for (let moveCell of potentialMoveCells) {
        if (moveCell.row === gridPos.row && moveCell.col === gridPos.col) {
          selectedUnit.moveTo(gridPos.row, gridPos.col); actionPerformed = true; break;
        }
      }
    }
    if (!actionPerformed && selectedUnit.canAttackNow()) {
      for (let attackCell of potentialAttackCells) {
        if (attackCell.row === gridPos.row && attackCell.col === gridPos.col) {
          let targetUnit = getUnitAt(attackCell.row, attackCell.col, units);
          if (targetUnit && targetUnit.isPlayer1 !== selectedUnit.isPlayer1) { selectedUnit.attack(targetUnit); actionPerformed = true; } break;
        }
      }
    }
    if (actionPerformed) {
      if (!selectedUnit.canMoveNow() && !selectedUnit.canAttackNow()) deselectAll(); else refreshPotentialActions();
    } else {
      if (clickedUnitInstance && clickedUnitInstance.isPlayer1 === currentPlayerIsP1) selectUnitForAction(clickedUnitInstance); else deselectAll();
    }
  } else { // No unit selected, try to select one
    if (clickedUnitInstance && clickedUnitInstance.isPlayer1 === currentPlayerIsP1) {
      if (clickedUnitInstance.canMoveNow() || clickedUnitInstance.canAttackNow()) selectUnitForAction(clickedUnitInstance);
    } else {
        deselectAll(); // Clicked empty space or enemy without selection
    }
  }
}

function isMouseOverActionButton() { /* ... (no changes) ... */ 
    return mouseX > actionButton.x && mouseX < actionButton.x + actionButton.w && mouseY > actionButton.y && mouseY < actionButton.y + actionButton.h;
}
function endTurn() { /* ... (no changes) ... */ 
    currentPlayerIsP1 = !currentPlayerIsP1; movesMadeThisTurn = 0; attacksMadeThisTurn = 0;
    currentDiceRollResult = ""; for (let unit of units) { unit.hasMovedThisTurn = false; unit.hasAttackedThisTurn = false; }
    deselectAll();
}
function windowResized() { /* ... (no changes) ... */ }

