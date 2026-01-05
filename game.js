// Game configuration options
const gameOptions = {
    groundY: 404,  // Top of road (450 - 46 road height)
    playerStartX: 400,
    obstacleSpeed: 300,
    spawnInterval: [1500, 2500],
    jumpForce: 450,
    gravity: 1200,
    playerHeight: 48,
    playerWidth: 48,   // Updated for square PNG sprites
    playerDuckHeight: 24,
    // Color collection system
    colorTypes: ['identity', 'approval', 'money'],
    maxColorSegments: 13,
    maxPercentageDifference: 10,  // Percentage difference threshold for imbalance (strict!)
    baseSpeed: 300,
    characterBaseSpeed: 300,
    speedBonusPerUnit: 0,
    imbalancePenaltyMultiplier: 1,  // Forgiving - allows more flexibility in color balance
    colorSpawnInterval: [400, 900],
    unitsPerPickup: 10,
    maxSpeed: 800,  // Speed cap to prevent game from becoming unplayable
    edgeCapX: 640,  // 80% of screen width - speed cap zone (can't outrun world speed here)
};

// Color palette (NES-inspired)
const colors = {
    // --- Background / Atmosphere (muted) ---
    sky: 0x141427,            // darker, less blue
    buildingsFar: 0x0b223f,   // pushed back with lower contrast
    buildingsNear: 0x243447,  // slightly lighter but still muted

    // --- Neon / Accents (pop against background) ---
    neonPink: 0xff2b6a,       // slightly deeper pink
    neonCyan: 0x00d1cc,       // cleaner cyan, less green

    // --- Environment ---
    windows: 0x3a3a2a,        // very muted, barely visible warm tone
    street: 0x3a3a3a,
    sidewalk: 0x5a5a5a,

    // --- Character ---
    skin: 0xffb08a,           // warmer, more natural
    shirt: 0x4c7dff,          // less saturated blue
    pants: 0x2b2f4f,          // deeper, less contrasty
    hair: 0x3a1f0f,

    // --- Props ---
    hydrant: 0xe64545,        // still red, slightly muted
    trash: 0x4a4a4a,
    drone: 0x7a7a7a,

    // --- Collectibles (3 ghost types) ---
    collectibleIdentity: 0xcc0000,
    collectibleIdentityLight: 0xff4444,

    collectibleApproval: 0x2462ff,
    collectibleApprovalLight: 0x5a8aff,

    collectibleMoney: 0xdfdfdf,
    collectibleMoneyLight: 0xffffff,

    // --- UI / Warnings ---
    imbalanceWarning: 0xff3b3b,
};


// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 450,
    backgroundColor: colors.sky,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Game instance
const game = new Phaser.Game(config);

// Scene variables
let player;
let obstacleGroup;

// Background system
let skyTileSprite;
let roadTileSprite;
let lightOverlay;
let buildingGroups = { far: null, mid: null, near: null };
let buildingPools = { far: null, mid: null, near: null };

// Building configuration
const buildingConfig = {
    far: {
        textures: ['building_far_1', 'building_far_2', 'building_far_3', 'building_far_4'],
        parallaxSpeed: 0.1,
        minGap: 20,
        maxGap: 60,
        depth: 1,
        scale: 0.4
    },
    mid: {
        textures: ['building_mid_1', 'building_mid_2', 'building_mid_3', 'building_mid_4', 'building_mid_5', 'building_mid_6'],
        parallaxSpeed: 0.3,
        minGap: 30,
        maxGap: 80,
        depth: 2,
        scale: 0.5
    },
    near: {
        textures: ['building_near_1', 'building_near_2', 'building_near_3', 'building_near_4', 'building_near_5', 'building_near_6'],
        parallaxSpeed: 0.6,
        minGap: 40,
        maxGap: 100,
        depth: 3,
        scale: 0.6
    }
};
let obstaclePool;
let isJumping = false;
let isDucking = false;
let obstacleTimer;
let runFrame = 0;
let runAnimTimer = 0;
let groundCollider;

// Color collection state
const maxSegments = 13;
let colorQueue = [];  // Array of color strings, max 13 elements (FIFO queue)
let colorCollectibleGroup;
let colorCollectiblePool;
let colorSpawnTimer;
let pieChartGraphics;  // Pie chart showing color balance
let characterSpeed;
let worldSpeed;
let timeSpeedBonus = 0;
let isImbalanced = false;
let imbalanceGraphics;
let distanceScore = 0;
let distanceText;
let jumpCount = 0;
const maxJumps = 2;  // Double jump
let pauseText;
let slowSpeedTimer = 0;
const slowSpeedThreshold = 0.4;  // 40% threshold
const slowSpeedDeathTime = 3000; // 3 seconds in ms
let areObstaclesEnabled = false;  // Disabled by default
let debugContainer;
let debugVisible = false;
let debugTexts = {};
let helpContainer;
let helpVisible = false;
let currentPenalty = 0;

// Game state management
const GAME_STATES = {
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
};
let gameState = GAME_STATES.START;
let startContainer;
let gameOverContainer;
let isFirstStart = true;

// Music and sound effects
let bgMusic;
let deathMusic;
let pickupSound;

// Screen size toggle
let isSmallScreen = false;
const SCREEN_SIZES = {
    large: { width: 800, height: 450 },
    small: { width: 480, height: 320 }
};

// Ghost helper system
let ghostSprite = null;
let ghostParticles = null;
let ghostLaugh = null;
let ghostRunSound = null;
let ghostActive = false;
let ghostTriggered = false;  // Prevents re-triggering until player recovers
const GHOST_TRIGGER_X = 200;  // 25% from left edge (200/800)
const GHOST_APPROACH_SPEED = 800;  // Fast approach from left
const GHOST_RUN_AWAY_SPEED = 600;  // Speed when running away

// Ghost phases
const GHOST_PHASE = {
    APPROACHING: 'approaching',    // Running from left to player
    RUNNING_WITH: 'running_with',  // Matching player speed, laugh playing
    RUNNING_AWAY: 'running_away'   // Running off to the right
};
let ghostPhase = null;

function preload() {
    // Load character sprites (replacing procedural generation)
    this.load.image('player_run1', 'images/character/run1.png');
    this.load.image('player_run2', 'images/character/run2.png');
    this.load.image('player_jump', 'images/character/jump.png');
    this.load.image('player_duck', 'images/character/duck.png');
    this.load.image('player_dead', 'images/character/death.png');

    createObstacles.call(this);
    createDeathParticles.call(this);

    // Load coin sprite sheets (8 frames each, 52x52 per frame)
    this.load.spritesheet('coin_identity', 'images/coins/identity-coin.png', { frameWidth: 52, frameHeight: 52 });
    this.load.spritesheet('coin_approval', 'images/coins/approval-coin.png', { frameWidth: 52, frameHeight: 52 });
    this.load.spritesheet('coin_money', 'images/coins/coin-coin.png', { frameWidth: 52, frameHeight: 52 });

    // Load background images
    this.load.image('bg_sky', 'images/backgrounds/Sky.png');
    this.load.image('bg_road', 'images/backgrounds/Road.png');
    this.load.image('bg_light', 'images/backgrounds/Light.png');

    // Load far buildings (4)
    this.load.image('building_far_1', 'images/buildings/far/BGB1.png');
    this.load.image('building_far_2', 'images/buildings/far/BGB2.png');
    this.load.image('building_far_3', 'images/buildings/far/BGB3.png');
    this.load.image('building_far_4', 'images/buildings/far/BGB4.png');

    // Load mid buildings (6)
    this.load.image('building_mid_1', 'images/buildings/mid/MBG1.png');
    this.load.image('building_mid_2', 'images/buildings/mid/MBG2.png');
    this.load.image('building_mid_3', 'images/buildings/mid/MBG3.png');
    this.load.image('building_mid_4', 'images/buildings/mid/MBG4.png');
    this.load.image('building_mid_5', 'images/buildings/mid/MBG5.png');
    this.load.image('building_mid_6', 'images/buildings/mid/MBG6.png');

    // Load near buildings (6)
    this.load.image('building_near_1', 'images/buildings/near/FGB1.png');
    this.load.image('building_near_2', 'images/buildings/near/FGB2.png');
    this.load.image('building_near_3', 'images/buildings/near/FBG3.png');
    this.load.image('building_near_4', 'images/buildings/near/FBG4.png');
    this.load.image('building_near_5', 'images/buildings/near/FBG5.png');
    this.load.image('building_near_6', 'images/buildings/near/FBG6.png');

    // Load music and sound effects
    this.load.audio('bgMusic', 'music/main-theme-eg.wav');
    this.load.audio('deathMusic', 'music/death-music.mp3');
    this.load.audio('pickupSound', 'music/blink.wav');

    // Load ghost sprites
    this.load.image('ghost_identity_1', 'images/ghost/Identity-Run1.png');
    this.load.image('ghost_identity_2', 'images/ghost/Identity-Run2.png');
    this.load.image('ghost_approval_1', 'images/ghost/Approval-Run1.png');
    this.load.image('ghost_approval_2', 'images/ghost/Approval-Run2.png');
    this.load.image('ghost_money_1', 'images/ghost/Money-Run1.png');
    this.load.image('ghost_money_2', 'images/ghost/Money-Run2.png');

    // Load ghost audio
    this.load.audio('ghostLaugh', 'music/ghost-laugh.mp3');
    this.load.audio('ghostRun', 'music/ghost-run.mp3');
}

// ============ BACKGROUND SYSTEM ============

function createBackgroundSystem() {
    // Sky - full screen tileSprite for seamless scrolling
    // Original: 1526x774, scale to fit 800x450 canvas
    skyTileSprite = this.add.tileSprite(400, 225, 800, 450, 'bg_sky');
    skyTileSprite.setDepth(0);
    skyTileSprite.setTileScale(800 / 1526, 450 / 774);

    // Initialize building groups and pools for each layer
    ['far', 'mid', 'near'].forEach(layer => {
        buildingGroups[layer] = this.add.group();
        buildingPools[layer] = this.add.group();
    });

    // Spawn initial buildings to fill screen
    spawnInitialBuildings.call(this);

    // Road at bottom - original 1526x92
    // Position so bottom of road aligns with bottom of canvas
    const roadScaleX = 800 / 1526;
    const roadScaleY = 0.5;  // Scale down height
    const roadHeight = 92 * roadScaleY;
    const roadY = 450 - roadHeight / 2;
    roadTileSprite = this.add.tileSprite(400, roadY, 800, roadHeight, 'bg_road');
    roadTileSprite.setDepth(5);
    roadTileSprite.setTileScale(roadScaleX, roadScaleY);

    // Light overlay - positioned so bottom meets road top
    // Original 1526x414, creates glow effect above road
    const lightScaleX = 800 / 1526;
    const lightScaleY = 0.5;
    const lightHeight = 414 * lightScaleY;
    const roadTopY = 450 - roadHeight;
    const lightY = roadTopY - lightHeight / 2;
    lightOverlay = this.add.tileSprite(400, lightY, 800, lightHeight, 'bg_light');
    lightOverlay.setDepth(4);
    lightOverlay.setTileScale(lightScaleX, lightScaleY);
    lightOverlay.setAlpha(0.6);
}

function spawnInitialBuildings() {
    // Fill screen with buildings from left edge to right edge + buffer
    ['far', 'mid', 'near'].forEach(layer => {
        let x = -100;  // Start slightly off-screen left
        while (x < 900) {  // Fill to beyond right edge
            const building = spawnBuilding.call(this, layer, x);
            if (building) {
                const scaledWidth = building.displayWidth;
                x = building.x + scaledWidth / 2 +
                    Phaser.Math.Between(buildingConfig[layer].minGap, buildingConfig[layer].maxGap);
            } else {
                x += 100;  // Fallback increment
            }
        }
    });
}

function spawnBuilding(layer, xPosition) {
    const config = buildingConfig[layer];
    const textureKey = Phaser.Utils.Array.GetRandom(config.textures);

    let building;

    // Try to get from pool first
    const pooled = buildingPools[layer].getFirst(false);
    if (pooled) {
        building = pooled;
        building.setTexture(textureKey);
        building.setActive(true);
        building.setVisible(true);
        buildingPools[layer].remove(building);
        buildingGroups[layer].add(building);
    } else {
        // Create new sprite
        building = this.add.sprite(0, 0, textureKey);
        buildingGroups[layer].add(building);
    }

    // Position building
    building.x = xPosition;
    // Align bottom of building to ground level (top of road)
    building.setOrigin(0.5, 1);
    building.y = gameOptions.groundY;
    building.setDepth(config.depth);
    building.setScale(config.scale);

    // Store layer info on the sprite
    building.buildingLayer = layer;

    return building;
}

function updateBuildingSpawns() {
    ['far', 'mid', 'near'].forEach(layer => {
        const config = buildingConfig[layer];
        const group = buildingGroups[layer];

        // Find rightmost building
        let rightmostX = -Infinity;
        group.getChildren().forEach(building => {
            if (building.active) {
                const rightEdge = building.x + building.displayWidth / 2;
                if (rightEdge > rightmostX) {
                    rightmostX = rightEdge;
                }
            }
        });

        // Spawn new building if rightmost is coming into view
        if (rightmostX < 850) {
            const gap = Phaser.Math.Between(config.minGap, config.maxGap);
            const newX = rightmostX + gap + 50;  // Add buffer for building center
            spawnBuilding.call(this, layer, newX);
        }

        // Recycle off-screen buildings (left edge)
        group.getChildren().forEach(building => {
            if (building.active && building.x + building.displayWidth / 2 < -50) {
                building.setActive(false);
                building.setVisible(false);
                buildingGroups[layer].remove(building);
                buildingPools[layer].add(building);
            }
        });
    });
}

function createDeathParticles() {
    const g = this.make.graphics({x:0, y:0, add:false});
    
    // Blood particle
    g.fillStyle(0xcc0000);
    g.fillRect(0,0,4,4);
    g.generateTexture('particle_blood', 4, 4);
    g.clear();
    
    // Brain/Skin particle
    g.fillStyle(colors.skin);
    g.fillRect(0,0,4,4);
    g.generateTexture('particle_skin', 4, 4);
    
    g.destroy();
}

function createCoinAnimations() {
    // Skip if animations already exist (scene restart)
    if (this.anims.exists('coin_identity_spin')) {
        return;
    }

    const coinTypes = ['identity', 'approval', 'money'];

    coinTypes.forEach(type => {
        this.anims.create({
            key: 'coin_' + type + '_spin',
            frames: this.anims.generateFrameNumbers('coin_' + type, { start: 0, end: 7 }),
            frameRate: 3,
            repeat: -1
        });
    });
}

function createObstacles() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const s = 3;

    // Fire hydrant
    g.fillStyle(colors.hydrant);
    g.fillRect(2*s, 0*s, 6*s, 3*s);
    g.fillRect(1*s, 3*s, 8*s, 10*s);
    g.fillRect(0*s, 5*s, 2*s, 3*s);
    g.fillRect(8*s, 5*s, 2*s, 3*s);
    g.fillRect(2*s, 13*s, 6*s, 3*s);
    g.fillStyle(0xff6666);
    g.fillRect(3*s, 4*s, 2*s, 6*s);
    g.generateTexture('obstacle_hydrant', 10*s, 16*s);
    g.clear();

    // Trash can
    g.fillStyle(colors.trash);
    g.fillRect(0*s, 2*s, 12*s, 14*s);
    g.fillStyle(0x666666);
    g.fillRect(1*s, 0*s, 10*s, 3*s);
    g.fillStyle(0x444444);
    g.fillRect(2*s, 5*s, 8*s, 2*s);
    g.fillRect(2*s, 10*s, 8*s, 2*s);
    g.generateTexture('obstacle_trash', 12*s, 16*s);
    g.clear();

    // Drone
    g.fillStyle(colors.drone);
    g.fillRect(4*s, 2*s, 8*s, 4*s);
    g.fillStyle(0x666666);
    g.fillRect(0*s, 0*s, 6*s, 2*s);
    g.fillRect(10*s, 0*s, 6*s, 2*s);
    g.fillStyle(colors.neonCyan);
    g.fillRect(6*s, 4*s, 4*s, 2*s);
    g.generateTexture('obstacle_drone', 16*s, 6*s);
    g.destroy();
}


// ============ DEBUG PANEL ============

function createDebugPanel() {
    debugContainer = this.add.container(590, 10);
    debugContainer.setDepth(150);

    // Background (smaller)
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, 200, 120);
    debugContainer.add(bg);

    // Title
    const title = this.add.text(100, 8, 'DEBUG', {
        fontSize: '12px',
        fill: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold'
    });
    title.setOrigin(0.5, 0);
    debugContainer.add(title);

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x666666);
    divider.beginPath();
    divider.moveTo(10, 24);
    divider.lineTo(190, 24);
    divider.strokePath();
    debugContainer.add(divider);

    // Text elements
    const textStyle = {
        fontSize: '11px',
        fill: '#ffffff',
        fontFamily: 'monospace'
    };

    let yPos = 30;
    const lineHeight = 16;

    debugTexts.colors = this.add.text(10, yPos, 'I:00 (33%)  A:00 (33%)  M:00 (33%)', textStyle);
    debugContainer.add(debugTexts.colors);
    yPos += lineHeight;

    debugTexts.characterSpeed = this.add.text(10, yPos, 'CHAR: 0', textStyle);
    debugContainer.add(debugTexts.characterSpeed);
    yPos += lineHeight;

    debugTexts.worldSpeed = this.add.text(10, yPos, 'WORLD: 0', textStyle);
    debugContainer.add(debugTexts.worldSpeed);
    yPos += lineHeight;

    debugTexts.modifier = this.add.text(10, yPos, 'BOOST: +0', textStyle);
    debugContainer.add(debugTexts.modifier);

    // Initially hidden
    debugContainer.setVisible(false);
}

function updateDebugPanel() {
    // Calculate color counts and percentages from queue
    const counts = { identity: 0, approval: 0, money: 0 };
    colorQueue.forEach(color => counts[color]++);
    const total = colorQueue.length || 1;  // Avoid division by zero

    const iPercent = Math.round((counts.identity / total) * 100);
    const aPercent = Math.round((counts.approval / total) * 100);
    const mPercent = Math.round((counts.money / total) * 100);

    debugTexts.colors.setText(
        'I:' + String(counts.identity).padStart(2, '0') + '(' + iPercent + '%) ' +
        'A:' + String(counts.approval).padStart(2, '0') + '(' + aPercent + '%) ' +
        'M:' + String(counts.money).padStart(2, '0') + '(' + mPercent + '%)'
    );

    debugTexts.characterSpeed.setText('CHAR: ' + Math.round(characterSpeed));
    debugTexts.worldSpeed.setText('WORLD: ' + Math.round(worldSpeed));

    // Show boost or penalty
    if (currentPenalty > 0) {
        debugTexts.modifier.setText('PENALTY: -' + Math.round(currentPenalty) + '%');
        debugTexts.modifier.setFill('#ff6666');
    } else {
        // Calculate boost (difference between char speed and base)
        const base = gameOptions.characterBaseSpeed + timeSpeedBonus;
        const boost = Math.round(characterSpeed - base);
        if (boost > 0) {
            debugTexts.modifier.setText('BOOST: +' + boost);
            debugTexts.modifier.setFill('#66ff66');
        } else {
            debugTexts.modifier.setText('BOOST: 0');
            debugTexts.modifier.setFill('#ffffff');
        }
    }
}

function toggleDebugPanel() {
    debugVisible = !debugVisible;
    debugContainer.setVisible(debugVisible);
}

function createHelpBox() {
    helpContainer = this.add.container(10, 10);
    helpContainer.setDepth(100);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.65);
    bg.fillRect(0, 0, 180, 120);
    helpContainer.add(bg);

    // Title
    const title = this.add.text(90, 8, 'CONTROLS', {
        fontSize: '11px',
        fill: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold'
    });
    title.setOrigin(0.5, 0);
    helpContainer.add(title);

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x666666);
    divider.beginPath();
    divider.moveTo(8, 24);
    divider.lineTo(172, 24);
    divider.strokePath();
    helpContainer.add(divider);

    // Control text
    const textStyle = {
        fontSize: '10px',
        fill: '#cccccc',
        fontFamily: 'monospace'
    };

    let yPos = 30;
    const lineHeight = 14;

    const controls = [
        'SPACE: Jump (x2)',
        'P: Pause',
        'M: Toggle Music',
        'O: Toggle Obstacles',
        'D: Debug Panel',
        'H: Help'
    ];

    controls.forEach(control => {
        const text = this.add.text(10, yPos, control, textStyle);
        helpContainer.add(text);
        yPos += lineHeight;
    });

    // Initially hidden
    helpContainer.setVisible(false);
}

function toggleHelpBox() {
    helpVisible = !helpVisible;
    helpContainer.setVisible(helpVisible);
}

function createStartScreen() {
    startContainer = this.add.container(400, 225);
    startContainer.setDepth(250);

    // Simple dark background box
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(-180, -70, 360, 130);
    startContainer.add(bg);

    // Three coins rotating above the title
    const coinTypes = ['identity', 'approval', 'money'];
    const coinSpacing = 40;
    coinTypes.forEach((type, index) => {
        const coinX = (index - 1) * coinSpacing; // -40, 0, 40
        const coin = this.add.sprite(coinX, -70, 'coin_' + type);
        coin.setOrigin(0.5);
        coin.setScale(0.5);
        coin.play('coin_' + type + '_spin');
        startContainer.add(coin);
    });

    // Game title in yellow
    const title = this.add.text(0, -30, 'RUNNING FOR FREEDOM', {
        fontSize: '24px',
        fill: '#C9A84E',
        fontFamily: 'monospace',
        fontStyle: 'bold'
    });
    title.setOrigin(0.5);
    startContainer.add(title);

    // Start prompt with pulsing effect
    const startPrompt = this.add.text(0, 15, 'Click or press SPACE to start', {
        fontSize: '14px',
        fill: '#ffffff',
        fontFamily: 'monospace'
    });
    startPrompt.setOrigin(0.5);
    startContainer.add(startPrompt);

    // Pulsing animation
    this.tweens.add({
        targets: startPrompt,
        alpha: 0.4,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // Initially hidden
    startContainer.setVisible(false);
}

function createGameOverScreen() {
    gameOverContainer = this.add.container(400, 225);
    gameOverContainer.setDepth(250);

    // Simple dark background box
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(-180, -95, 360, 175);
    gameOverContainer.add(bg);

    // Three coins rotating above the title
    const coinTypes = ['identity', 'approval', 'money'];
    const coinSpacing = 40;
    coinTypes.forEach((type, index) => {
        const coinX = (index - 1) * coinSpacing; // -40, 0, 40
        const coin = this.add.sprite(coinX, -95, 'coin_' + type);
        coin.setOrigin(0.5);
        coin.setScale(0.5);
        coin.play('coin_' + type + '_spin');
        gameOverContainer.add(coin);
    });

    // Game Over title in yellow
    const title = this.add.text(0, -50, 'GAME OVER', {
        fontSize: '28px',
        fill: '#C9A84E',
        fontFamily: 'monospace',
        fontStyle: 'bold'
    });
    title.setOrigin(0.5);
    gameOverContainer.add(title);

    // Score value (will be updated when shown)
    const scoreValue = this.add.text(0, 0, '0', {
        fontSize: '36px',
        fill: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold'
    });
    scoreValue.setOrigin(0.5);
    scoreValue.setName('scoreValue');
    gameOverContainer.add(scoreValue);

    // Restart prompt with pulsing effect
    const restartText = this.add.text(0, 45, 'Click or press SPACE to restart', {
        fontSize: '14px',
        fill: '#ffffff',
        fontFamily: 'monospace'
    });
    restartText.setOrigin(0.5);
    restartText.setName('restartText');
    gameOverContainer.add(restartText);

    // Pulsing animation
    this.tweens.add({
        targets: restartText,
        alpha: 0.4,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // Initially hidden
    gameOverContainer.setVisible(false);
}

function showStartScreen() {
    gameState = GAME_STATES.START;
    startContainer.setVisible(true);

    // Register start listeners
    this.input.once('pointerdown', startGame, this);
    this.input.keyboard.once('keydown-SPACE', startGame, this);
}

function showGameOverScreen() {
    gameState = GAME_STATES.GAMEOVER;

    // Update score
    const scoreValue = gameOverContainer.getByName('scoreValue');
    scoreValue.setText(Math.floor(distanceScore).toString());

    // Show container
    gameOverContainer.setVisible(true);

    // Register restart listeners
    this.input.once('pointerdown', restartGame, this);
    this.input.keyboard.once('keydown-SPACE', restartGame, this);
}

function startGame() {
    gameState = GAME_STATES.PLAYING;
    startContainer.setVisible(false);
    gameOverContainer.setVisible(false);
    isFirstStart = false;

    // Show gameplay UI
    distanceText.setVisible(true);
    pieChartGraphics.setVisible(true);

    // Start background music
    if (bgMusic && !bgMusic.isPlaying) {
        bgMusic.play();
    }

    // Start spawning obstacles and collectibles
    scheduleNextObstacle.call(this);
    scheduleNextColorCollectible.call(this);
}

// ============ GAME LOGIC ============

function create() {
    // Reset state
    isJumping = false;
    isDucking = false;
    runFrame = 0;
    // Pre-fill colorQueue with 4 of each color (balanced start: 4,4,4 = 12 items)
    colorQueue = [];
    for (let i = 0; i < 4; i++) {
        colorQueue.push('identity');
        colorQueue.push('approval');
        colorQueue.push('money');
    }
    characterSpeed = gameOptions.characterBaseSpeed;
    worldSpeed = gameOptions.baseSpeed;
    timeSpeedBonus = 0;
    isImbalanced = false;
    distanceScore = 0;
    jumpCount = 0;
    areObstaclesEnabled = false;  // Disabled by default (press O to enable)
    gameState = GAME_STATES.START;

    // Create background music if not already created
    if (!bgMusic) {
        bgMusic = this.sound.add('bgMusic', {
            loop: true,
            volume: 0.5,
            rate: 1.25  // 1.25x base speed (increases automatically based on speed gap)
        });
    }

    // Create death music if not already created
    if (!deathMusic) {
        deathMusic = this.sound.add('deathMusic', {
            loop: false,
            volume: 0.5
        });
    }

    // Create pickup sound if not already created
    if (!pickupSound) {
        pickupSound = this.sound.add('pickupSound', {
            volume: 0.3,
            rate: 2.0  // 2x speed for quick, snappy pickup sound
        });
    }

    // Create ghost sounds
    if (!ghostLaugh) {
        ghostLaugh = this.sound.add('ghostLaugh', {
            volume: 0.5,
            rate: 2.0  // 2x speed
        });
    }
    if (!ghostRunSound) {
        ghostRunSound = this.sound.add('ghostRun', {
            volume: 0.5
        });
    }

    // Create PNG-based background system (sky, buildings, light, road)
    createBackgroundSystem.call(this);

    // Create coin spin animations from sprite sheets
    createCoinAnimations.call(this);

    // Ground collider - positioned so TOP is at road surface (gameOptions.groundY)
    // Center at groundY + 20 so collider extends from Y=404 to Y=444
    groundCollider = this.add.rectangle(400, gameOptions.groundY + 20, 2400, 40, 0x000000, 0);
    this.physics.add.existing(groundCollider, true);

    // Groups
    obstacleGroup = this.physics.add.group();
    obstaclePool = this.add.group();
    colorCollectibleGroup = this.physics.add.group();
    colorCollectiblePool = this.add.group();

    // Player
    player = this.physics.add.sprite(
        gameOptions.playerStartX,
        gameOptions.groundY - gameOptions.playerHeight - 20, // Spawn well above ground
        'player_run1'
    );
    player.setScale(0.5);  // Scale 94px sprites down to ~47px
    player.setOrigin(0.5, 1);  // Anchor at feet for ground alignment
    player.setGravityY(gameOptions.gravity);

    // Set physics body to match scaled sprite size
    // Offset moves collision box up, so sprite renders lower (on road surface)
    player.body.setSize(94, 94);
    player.body.setOffset(0, -20);

    // Configure world bounds to allow left exit and bottom exit (falling death)
    this.physics.world.setBoundsCollision(false, true, true, false);
    player.setCollideWorldBounds(true);

    player.setDepth(10);

    // Collisions
    this.physics.add.collider(player, groundCollider);
    this.physics.add.overlap(player, obstacleGroup, gameOver, null, this);
    this.physics.add.overlap(player, colorCollectibleGroup, collectColorItem, null, this);

    // Input
    this.input.on('pointerdown', jump, this);
    this.input.keyboard.on('keydown-SPACE', jump, this);
    this.input.keyboard.on('keydown-UP', jump, this);
    this.input.keyboard.on('keydown-W', jump, this);
    // Duck disabled for now - can re-enable later
    // this.input.keyboard.on('keydown-DOWN', startDuck, this);
    // this.input.keyboard.on('keydown-S', startDuck, this);
    // this.input.keyboard.on('keyup-DOWN', stopDuck, this);
    // this.input.keyboard.on('keyup-S', stopDuck, this);
    this.input.keyboard.on('keydown-P', togglePause, this);
    this.input.keyboard.on('keydown-O', toggleObstacles, this);
    this.input.keyboard.on('keydown-D', toggleDebugPanel, this);
    this.input.keyboard.on('keydown-M', toggleMusic, this);
    this.input.keyboard.on('keydown-H', toggleHelpBox, this);

    // DON'T start spawning immediately - wait for startGame() to be called

    // Create pie chart for color balance display
    createPieChart.call(this);

    // Imbalance indicator
    imbalanceGraphics = this.add.graphics();
    imbalanceGraphics.setDepth(50);

    // Speed indicator removed - use debug panel (D key) for speed info

    // Distance/Score display (hidden initially - shown when game starts)
    // Positioned to the left of pie chart (pie is at x=775, radius=14)
    distanceText = this.add.text(755, 25, '0', {
        fontSize: '18px',
        fill: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold'
    });
    distanceText.setOrigin(1, 0.5);  // Right-aligned
    distanceText.setDepth(100);
    distanceText.setVisible(false);

    // Pause text (hidden initially)
    pauseText = this.add.text(400, 225, 'PAUSED\n\nPress P to Resume', {
        fontSize: '32px',
        fill: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        align: 'center',
        backgroundColor: '#000000',
        padding: { x: 20, y: 20 }
    });
    pauseText.setOrigin(0.5);
    pauseText.setDepth(200);
    pauseText.setVisible(false);

    // Create debug panel
    createDebugPanel.call(this);

    // Create help box
    createHelpBox.call(this);

    // Create start and game over screens
    createStartScreen.call(this);
    createGameOverScreen.call(this);

    // Increase speed every 5 seconds (only during gameplay)
    this.time.addEvent({
        delay: 5000,
        callback: () => {
            if (gameState === GAME_STATES.PLAYING) {
                timeSpeedBonus += 20;
            }
        },
        loop: true
    });

    // Show start screen only on first load, otherwise go straight to game
    if (isFirstStart) {
        showStartScreen.call(this);
    } else {
        startGame.call(this);
    }
}

function createPieChart() {
    pieChartGraphics = this.add.graphics();
    pieChartGraphics.setDepth(100);
    pieChartGraphics.setVisible(false);  // Hidden until game starts
}

function updatePieChart() {
    pieChartGraphics.clear();

    // Position on right side of screen (smaller size)
    const centerX = 775;
    const centerY = 25;
    const radius = 14;

    // Count colors in queue
    const counts = { identity: 0, approval: 0, money: 0 };
    colorQueue.forEach(color => counts[color]++);
    const total = colorQueue.length;

    if (total === 0) {
        // Empty pie - just draw outline
        pieChartGraphics.lineStyle(2, 0x666666, 0.5);
        pieChartGraphics.strokeCircle(centerX, centerY, radius);
        return;
    }

    const colorHexMap = {
        identity: colors.collectibleIdentity,
        approval: colors.collectibleApproval,
        money: colors.collectibleMoney
    };

    // Draw pie slices - grouped by color, always in same order
    let startAngle = -Math.PI / 2;  // Start from top (12 o'clock)
    const colorOrder = ['identity', 'approval', 'money'];

    colorOrder.forEach(colorType => {
        const count = counts[colorType];
        if (count > 0) {
            const sliceAngle = (count / total) * Math.PI * 2;
            const endAngle = startAngle + sliceAngle;

            pieChartGraphics.fillStyle(colorHexMap[colorType], 1);
            pieChartGraphics.beginPath();
            pieChartGraphics.moveTo(centerX, centerY);
            pieChartGraphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
            pieChartGraphics.closePath();
            pieChartGraphics.fillPath();

            startAngle = endAngle;
        }
    });

    // Draw border
    pieChartGraphics.lineStyle(1, 0x070B12, 1);
    pieChartGraphics.strokeCircle(centerX, centerY, radius);
}

// ============ SPEED & BALANCE SYSTEM ============

function calculateCharacterSpeed() {
    const counts = { identity: 0, approval: 0, money: 0 };
    colorQueue.forEach(color => counts[color]++);

    const total = colorQueue.length;

    // Handle empty queue edge case
    if (total === 0) {
        characterSpeed = gameOptions.characterBaseSpeed + timeSpeedBonus;
        isImbalanced = false;
        currentPenalty = 0;
        return;
    }

    const percentages = Object.values(counts).map(c => (c / total) * 100);
    const maxPercent = Math.max(...percentages);
    const minPercent = Math.min(...percentages);
    const difference = maxPercent - minPercent;

    // Neutral threshold = "off by 1" = ~16.67% diff (e.g., 5,4,3 with 12 items)
    const neutralThreshold = 100 / 6;

    // Current base = characterBaseSpeed + timeSpeedBonus
    const currentBase = gameOptions.characterBaseSpeed + timeSpeedBonus;

    if (difference <= neutralThreshold) {
        // BOOST ZONE: Additive bonus (fixed amount, doesn't scale with speed)
        // +15 at perfect balance, linearly decreasing to 0 at threshold
        const maxBoost = 15;
        const boost = maxBoost * (1 - difference / neutralThreshold);
        characterSpeed = currentBase + boost;
        isImbalanced = false;
        currentPenalty = 0;
    } else {
        // PENALTY ZONE: Multiplicative penalty (scales with current speed)
        // Apply 80% of the percentage difference as penalty (dampened)
        const dampening = 0.8;
        const penaltyMultiplier = (difference / 100) * dampening;
        characterSpeed = currentBase * (1 - penaltyMultiplier);
        isImbalanced = true;
        currentPenalty = difference * dampening;
    }

    // Cap at max speed
    characterSpeed = Math.min(gameOptions.maxSpeed, characterSpeed);
    characterSpeed = Math.max(0, characterSpeed);
}

function calculateWorldSpeed() {
    // World speed is simply base + time bonus (unaffected by balance modifier)
    worldSpeed = gameOptions.baseSpeed + timeSpeedBonus;
    worldSpeed = Math.min(gameOptions.maxSpeed, worldSpeed);
}

function updateImbalanceIndicator() {
    imbalanceGraphics.clear();

    // Red border and tint trigger when ghost is active (player in danger zone)
    if (ghostActive) {
        imbalanceGraphics.lineStyle(6, colors.imbalanceWarning, 0.6);
        imbalanceGraphics.strokeRect(3, 3, 794, 444);
        player.setTint(0xffaaaa);
    } else {
        player.clearTint();
    }
}

// Speed indicator removed - speed info now in debug panel (press D)

// ============ SPAWNING ============

// Helper to fully reset pooled objects before reuse
function resetPooledObject(obj) {
    obj.setScale(1);
    obj.setAlpha(1);
    obj.clearTint();
    obj.setAngle(0);
    obj.setVelocity(0, 0);
}

// Calculate spawn interval based on current speed (faster = shorter intervals)
function getAdjustedSpawnInterval() {
    const speedRatio = currentSpeed / gameOptions.baseSpeed;
    const baseMin = gameOptions.spawnInterval[0];
    const baseMax = gameOptions.spawnInterval[1];
    // Reduce interval as speed increases to maintain obstacle density
    return [Math.max(500, baseMin / speedRatio), Math.max(800, baseMax / speedRatio)];
}

function scheduleNextObstacle() {
    const delay = Phaser.Math.Between(gameOptions.spawnInterval[0], gameOptions.spawnInterval[1]);
    obstacleTimer = this.time.delayedCall(delay, () => {
        spawnObstacle.call(this);
        scheduleNextObstacle.call(this);
    });
}

function scheduleNextColorCollectible() {
    const delay = Phaser.Math.Between(gameOptions.colorSpawnInterval[0], gameOptions.colorSpawnInterval[1]);
    colorSpawnTimer = this.time.delayedCall(delay, () => {
        spawnColorCollectible.call(this);
        scheduleNextColorCollectible.call(this);
    });
}

function spawnObstacle() {
    if (!areObstaclesEnabled) return;

    const isLow = Math.random() < 0.6;
    const types = isLow ? ['obstacle_hydrant', 'obstacle_trash'] : ['obstacle_drone'];
    const textureKey = types[Math.floor(Math.random() * types.length)];

    let obstacle;
    const pooled = obstaclePool.getChildren().find(o => o.texture && o.texture.key === textureKey);

    if (pooled) {
        obstacle = pooled;
        resetPooledObject(obstacle);  // Reset all properties before reuse
        obstacle.setActive(true);
        obstacle.setVisible(true);
        obstaclePool.remove(obstacle);
        obstacleGroup.add(obstacle);
        obstacle.body.enable = true;
    } else {
        obstacle = this.physics.add.sprite(0, 0, textureKey);
        obstacle.setImmovable(true);
        obstacle.body.allowGravity = false;
        obstacleGroup.add(obstacle);
    }

    obstacle.x = 850;
    obstacle.setDepth(8);  // Between ground layers and player (depth 10)
    // Low obstacles on ground, drones just above player head height
    obstacle.y = isLow ? gameOptions.groundY - obstacle.height / 2 : gameOptions.groundY - 80;
    obstacle.setVelocityX(-worldSpeed);
}

function spawnColorCollectible() {
    const colorType = selectColorToSpawn();
    const textureKey = 'coin_' + colorType;

    let collectible;
    const pooled = colorCollectiblePool.getChildren().find(c => c.colorType === colorType);

    if (pooled) {
        collectible = pooled;
        resetPooledObject(collectible);  // Reset all properties before reuse
        collectible.setTexture(textureKey);  // Update texture for pooled object
        collectible.setActive(true);
        collectible.setVisible(true);
        colorCollectiblePool.remove(collectible);
        colorCollectibleGroup.add(collectible);
        collectible.body.enable = true;
    } else {
        collectible = this.physics.add.sprite(0, 0, textureKey);
        collectible.body.allowGravity = false;
        colorCollectibleGroup.add(collectible);
    }

    collectible.colorType = colorType;
    collectible.x = 850;
    collectible.setScale(0.5);  // Scale down to 50%
    collectible.setDepth(8);  // Between ground layers and player (depth 10)

    // Random height: from ground level (runnable) to jump height
    // Range extends to very low positions to prevent duck exploit
    const minY = gameOptions.groundY - 200;  // High point (jump to reach)
    const maxY = gameOptions.groundY - 10;   // Very low point (below duck height)
    collectible.y = Phaser.Math.Between(minY, maxY);
    collectible.setVelocityX(-worldSpeed);

    // Play spin animation (starts at random frame for variety)
    collectible.play('coin_' + colorType + '_spin');
    collectible.anims.setProgress(Math.random());
}

function selectColorToSpawn() {
    // 100% weighted toward most collected (no random - very hard to balance!)
    // Calculate counts from queue for weighted selection
    const counts = { identity: 0, approval: 0, money: 0 };
    colorQueue.forEach(color => counts[color]++);

    // Calculate total weight based on actual counts (more collected = much higher weight)
    const totalWeight = Object.values(counts).reduce((sum, count) => {
        return sum + (count + 1);  // Minimal base weight for extreme feedback
    }, 0);

    let random = Math.random() * totalWeight;
    for (const color of gameOptions.colorTypes) {
        const weight = counts[color] + 1;  // Extreme feedback loop - over-collected colors dominate spawns
        random -= weight;
        if (random <= 0) return color;
    }
    return 'identity';
}

// ============ COLLECTION ============

function collectColorItem(playerSprite, collectible) {
    // Prevent double-collection: check if already being collected
    if (!collectible.active || collectible.collected) return;
    collectible.collected = true;  // Mark as collected immediately

    // Play pickup sound at 2x speed
    if (pickupSound) {
        pickupSound.play();
    }

    const colorType = collectible.colorType;

    // Add to queue - FIFO logic
    if (colorQueue.length < maxSegments) {
        // Still filling up - add to end (top of visual stack)
        colorQueue.push(colorType);
    } else {
        // Queue is full - remove oldest (bottom), add newest (top)
        colorQueue.shift();  // Remove index 0 (oldest/bottom)
        colorQueue.push(colorType);  // Add to end (newest/top)
    }

    updatePieChart();
    calculateCharacterSpeed();
    calculateWorldSpeed();

    // Disable collision immediately
    collectible.body.enable = false;

    // Kill any existing tweens on this object before adding new one
    this.tweens.killTweensOf(collectible);

    // Visual feedback
    this.tweens.add({
        targets: collectible,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 100,
        onComplete: () => {
            collectible.setScale(1);
            collectible.setAlpha(1);
            collectible.anims.stop();  // Stop animation for reuse
            collectible.setActive(false);
            collectible.setVisible(false);
            collectible.setVelocityX(0);
            collectible.collected = false;  // Reset for reuse
            colorCollectibleGroup.remove(collectible);
            colorCollectiblePool.add(collectible);
        }
    });
}

// ============ PLAYER ACTIONS ============

function togglePause() {
    // Only allow pausing during gameplay
    if (gameState === GAME_STATES.PLAYING) {
        gameState = GAME_STATES.PAUSED;
        // Pause the game
        this.physics.pause();
        pauseText.setVisible(true);

        // Pause timers
        if (obstacleTimer) obstacleTimer.paused = true;
        if (colorSpawnTimer) colorSpawnTimer.paused = true;

        // Pause music
        if (bgMusic && bgMusic.isPlaying) {
            bgMusic.pause();
        }
    } else if (gameState === GAME_STATES.PAUSED) {
        gameState = GAME_STATES.PLAYING;
        // Resume the game
        this.physics.resume();
        pauseText.setVisible(false);

        // Resume timers
        if (obstacleTimer) obstacleTimer.paused = false;
        if (colorSpawnTimer) colorSpawnTimer.paused = false;

        // Resume music
        if (bgMusic && bgMusic.isPaused) {
            bgMusic.resume();
        }
    }
}

function toggleObstacles() {
    areObstaclesEnabled = !areObstaclesEnabled;

    const status = areObstaclesEnabled ? "ON" : "OFF";
    const color = areObstaclesEnabled ? "#66ff66" : "#ff6666";

    const feedback = this.add.text(400, 200, `OBSTACLES: ${status}`, {
        fontSize: '32px',
        fill: color,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
        targets: feedback,
        alpha: 0,
        y: 150,
        duration: 1000,
        onComplete: () => feedback.destroy()
    });
}

function toggleMusic() {
    if (!bgMusic) return;

    if (bgMusic.isPlaying) {
        bgMusic.pause();
    } else if (bgMusic.isPaused) {
        bgMusic.resume();
    }

    const status = bgMusic.isPlaying ? "ON" : "OFF";
    const color = bgMusic.isPlaying ? "#66ff66" : "#ff6666";

    const feedback = this.add.text(400, 200, `MUSIC: ${status}`, {
        fontSize: '32px',
        fill: color,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
        targets: feedback,
        alpha: 0,
        y: 150,
        duration: 1000,
        onComplete: () => feedback.destroy()
    });
}

function toggleScreenSize() {
    isSmallScreen = !isSmallScreen;
    const size = isSmallScreen ? SCREEN_SIZES.small : SCREEN_SIZES.large;

    // Resize the game canvas
    game.scale.resize(size.width, size.height);

    const label = isSmallScreen ? "480x320" : "800x450";
    const feedback = this.add.text(
        size.width / 2,
        size.height / 2 - 50,
        `SCREEN: ${label}`,
        {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }
    ).setOrigin(0.5).setDepth(300);

    this.tweens.add({
        targets: feedback,
        alpha: 0,
        y: size.height / 2 - 100,
        duration: 1000,
        onComplete: () => feedback.destroy()
    });
}

function jump() {
    const onGround = player.body.blocked.down || player.body.touching.down;

    // Can jump if on ground OR if in air with jumps remaining (double jump)
    if (!isDucking && (onGround || jumpCount < maxJumps)) {
        if (onGround) {
            jumpCount = 0;  // Reset jump count when on ground
        }

        player.setVelocityY(-gameOptions.jumpForce);
        isJumping = true;
        jumpCount++;
        player.setTexture('player_jump');
    }
}

// ============ GHOST HELPER SYSTEM ============

function getLeastColor() {
    const counts = { identity: 0, approval: 0, money: 0 };
    colorQueue.forEach(color => counts[color]++);

    let minColor = 'identity';
    let minCount = counts.identity;

    for (const color in counts) {
        if (counts[color] < minCount) {
            minCount = counts[color];
            minColor = color;
        }
    }
    return minColor;
}

function spawnGhost() {
    const leastColor = getLeastColor();
    const textureKey = 'ghost_' + leastColor + '_1';

    // Ghost starts off-screen left
    ghostSprite = this.physics.add.sprite(-50, gameOptions.groundY, textureKey);
    ghostSprite.setOrigin(0.5, 1);  // Anchor at feet like player
    ghostSprite.setDepth(9);  // Behind player (10) but above obstacles (8)
    ghostSprite.setScale(0.5);  // Match character size
    ghostSprite.setAlpha(0.5);  // 50% opacity
    ghostSprite.body.allowGravity = false;
    ghostSprite.ghostColor = leastColor;
    ghostSprite.animFrame = 0;
    ghostSprite.animTimer = 0;

    // Target position: just in front of player (30px ahead)
    ghostSprite.targetX = player.x + 30;

    // Start in approaching phase
    ghostPhase = GHOST_PHASE.APPROACHING;
    ghostSprite.setVelocityX(GHOST_APPROACH_SPEED);
    ghostActive = true;

    // Create particle trail
    const colorHex = {
        identity: 0xcc0000,
        approval: 0x2462ff,
        money: 0xdfdfdf
    };

    ghostParticles = this.add.particles(0, 0, 'particle_skin', {
        follow: ghostSprite,
        followOffset: { x: -20, y: 0 },
        speed: { min: 20, max: 50 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 400,
        frequency: 50,
        tint: colorHex[leastColor]
    });
    ghostParticles.setDepth(8);

    // Show "You're falling behind.." text with animation
    const warningText = this.add.text(400, 150, "You're falling behind..", {
        fontSize: '18px',
        fill: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
    });
    warningText.setOrigin(0.5);
    warningText.setDepth(100);
    warningText.setAlpha(0);

    // Fade in, hold, then fade out
    this.tweens.add({
        targets: warningText,
        alpha: 1,
        y: 130,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
            this.tweens.add({
                targets: warningText,
                alpha: 0,
                y: 110,
                delay: 1000,
                duration: 500,
                onComplete: () => warningText.destroy()
            });
        }
    });
}

function updateGhost(delta) {
    if (!ghostSprite || !ghostActive) return;

    // Animate ghost (2-frame loop)
    ghostSprite.animTimer += delta;
    if (ghostSprite.animTimer > 100) {
        ghostSprite.animTimer = 0;
        ghostSprite.animFrame = (ghostSprite.animFrame + 1) % 2;
        ghostSprite.setTexture('ghost_' + ghostSprite.ghostColor + '_' + (ghostSprite.animFrame + 1));
    }

    // Phase-based behavior
    switch (ghostPhase) {
        case GHOST_PHASE.APPROACHING:
            // Ghost is running fast from left toward player
            if (ghostSprite.x >= player.x + 30) {
                // Reached target position - switch to running with player
                ghostPhase = GHOST_PHASE.RUNNING_WITH;
                ghostSprite.setVelocityX(0);  // Will be updated each frame

                // Play laugh track
                if (ghostLaugh) {
                    ghostLaugh.play();
                    // When laugh ends, switch to running away
                    ghostLaugh.once('complete', () => {
                        if (ghostActive && ghostPhase === GHOST_PHASE.RUNNING_WITH) {
                            ghostPhase = GHOST_PHASE.RUNNING_AWAY;
                            ghostSprite.setVelocityX(GHOST_RUN_AWAY_SPEED);
                            // Play run-away sound
                            if (ghostRunSound) {
                                ghostRunSound.play();
                            }
                        }
                    });
                }
            }
            break;

        case GHOST_PHASE.RUNNING_WITH:
            // Ghost matches character speed, stays just ahead of player
            // Move ghost with same net movement as player
            const characterMovement = (characterSpeed * delta) / 1000;
            const worldMovement = (worldSpeed * delta) / 1000;
            ghostSprite.x += characterMovement - worldMovement;
            // Keep ghost slightly ahead of player
            if (ghostSprite.x < player.x + 20) {
                ghostSprite.x = player.x + 20;
            }
            break;

        case GHOST_PHASE.RUNNING_AWAY:
            // Ghost runs off to the right
            // Despawn when off-screen right
            if (ghostSprite.x > 850) {
                cleanupGhost();
            }
            break;
    }
}

function cleanupGhost() {
    if (ghostSprite) {
        ghostSprite.destroy();
        ghostSprite = null;
    }
    if (ghostParticles) {
        ghostParticles.destroy();
        ghostParticles = null;
    }
    ghostActive = false;
    ghostPhase = null;
}

function startDuck() {
    const onGround = player.body.blocked.down || player.body.touching.down;
    if (onGround && !isJumping) {
        isDucking = true;
        player.setTexture('player_duck');
        // Shrink hitbox to half height, keep bottom aligned with normal stance
        // Normal: size 94, offset -20, bottom at -20+94=74
        // Duck: size 47, offset should give bottom at 74: offset+47=74, offset=27
        player.body.setSize(94, 47);
        player.body.setOffset(0, 27);
    }
}

function stopDuck() {
    if (isDucking) {
        isDucking = false;
        player.setTexture('player_run1');
        // Restore full hitbox with original offset
        player.body.setSize(94, 94);
        player.body.setOffset(0, -20);
    }
}

function gameOver() {
    if (gameState === GAME_STATES.GAMEOVER) return;  // Prevent multiple triggers

    // Unpause if paused
    if (gameState === GAME_STATES.PAUSED) {
        this.physics.resume();
    }

    // Pause physics to stop all movement
    this.physics.pause();

    // Visuals: Headless body
    player.setTexture('player_dead');
    player.setTint(0xffffff); // Reset tint

    // Head explosion particles
    const pConfig = {
        speed: { min: 100, max: 300 },
        angle: { min: 220, max: 320 }, // Up and out
        scale: { start: 1, end: 0 },
        gravityY: 800,
        lifespan: 1000,
        quantity: 30,
        emitting: false
    };

    // Blood
    const blood = this.add.particles(player.x, player.y - 20, 'particle_blood', pConfig);
    blood.explode(30);

    // Brains/Skin
    const bits = this.add.particles(player.x, player.y - 20, 'particle_skin', {
        ...pConfig,
        speed: { min: 50, max: 200 },
        quantity: 10
    });
    bits.explode(15);

    this.cameras.main.shake(300, 0.02);

    // Stop current music and play death music
    if (bgMusic && bgMusic.isPlaying) {
        bgMusic.stop();
    }

    if (deathMusic) {
        deathMusic.play();

        // When death music ends, resume main theme at half speed
        deathMusic.once('complete', () => {
            if (bgMusic) {
                bgMusic.setRate(0.625);  // Half of base 1.25 rate
                bgMusic.play();
            }
        });
    }

    // Stop spawning
    if (obstacleTimer) obstacleTimer.destroy();
    if (colorSpawnTimer) colorSpawnTimer.destroy();

    // Show game over screen with score
    showGameOverScreen.call(this);
}

function restartGame() {
    // Remove all input listeners to prevent accumulation on restart
    this.input.off('pointerdown', jump, this);
    this.input.keyboard.off('keydown-SPACE', jump, this);
    this.input.keyboard.off('keydown-UP', jump, this);
    this.input.keyboard.off('keydown-W', jump, this);
    // Duck disabled for now
    // this.input.keyboard.off('keydown-DOWN', startDuck, this);
    // this.input.keyboard.off('keydown-S', startDuck, this);
    // this.input.keyboard.off('keyup-DOWN', stopDuck, this);
    // this.input.keyboard.off('keyup-S', stopDuck, this);
    this.input.keyboard.off('keydown-P', togglePause, this);
    this.input.keyboard.off('keydown-O', toggleObstacles, this);
    this.input.keyboard.off('keydown-D', toggleDebugPanel, this);
    this.input.keyboard.off('keydown-M', toggleMusic, this);
    this.input.keyboard.off('keydown-H', toggleHelpBox, this);

    // Remove restart listeners
    this.input.off('pointerdown', restartGame, this);
    this.input.keyboard.off('keydown-SPACE', restartGame, this);

    // Kill all active tweens to prevent them corrupting recycled objects
    this.tweens.killAll();

    // Stop death music if playing
    if (deathMusic && deathMusic.isPlaying) {
        deathMusic.stop();
    }

    // Reset bgMusic rate for next game
    if (bgMusic) {
        bgMusic.stop();
        bgMusic.setRate(1.25);  // Reset to base rate
    }

    // Reset game state
    slowSpeedTimer = 0;

    // Reset ghost state
    ghostActive = false;
    ghostTriggered = false;
    ghostPhase = null;
    if (ghostSprite) {
        ghostSprite.destroy();
        ghostSprite = null;
    }
    if (ghostParticles) {
        ghostParticles.destroy();
        ghostParticles = null;
    }
    // Stop ghost sounds if playing
    if (ghostLaugh && ghostLaugh.isPlaying) {
        ghostLaugh.stop();
    }
    if (ghostRunSound && ghostRunSound.isPlaying) {
        ghostRunSound.stop();
    }

    // Restart scene (this will call create() again which shows the start screen)
    this.scene.restart();
}

// ============ UPDATE LOOP ============

function update(time, delta) {
    // Only run gameplay updates when actually playing
    if (gameState !== GAME_STATES.PLAYING) return;

    // Calculate both character and world speeds
    calculateCharacterSpeed();
    calculateWorldSpeed();

    // Auto-enable obstacles when character speed reaches cap
    if (characterSpeed >= gameOptions.maxSpeed && !areObstaclesEnabled) {
        areObstaclesEnabled = true;
        scheduleNextObstacle.call(this);

        // Show feedback
        const feedback = this.add.text(400, 200, 'MAX SPEED REACHED!\nOBSTACLES ENABLED', {
            fontSize: '28px',
            fill: '#ff6666',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(300);

        this.tweens.add({
            targets: feedback,
            alpha: 0,
            y: 150,
            duration: 2000,
            onComplete: () => feedback.destroy()
        });
    }

    // Update music speed based on speed gap (automatic tension system)
    if (bgMusic && bgMusic.isPlaying) {
        const speedGap = worldSpeed - characterSpeed;
        const baseRate = 1.25;
        const gapMultiplier = speedGap / 200;  // 0 to 1+ range
        const musicRate = baseRate + (gapMultiplier * 1.25);  // 1.25x to 2.5x+
        const clampedRate = Math.max(1.0, Math.min(3.0, musicRate));
        bgMusic.setRate(clampedRate);
    }

    // Cap character speed at edge - can't outrun world speed at 80%
    if (player.x >= gameOptions.edgeCapX) {
        characterSpeed = Math.min(characterSpeed, worldSpeed);
    }

    // Move player forward based on character speed
    const characterMovement = (characterSpeed * delta) / 1000;
    const worldMovement = (worldSpeed * delta) / 1000;

    // Net movement: character moves forward, world moves backward (relative to player)
    player.x += characterMovement - worldMovement;

    // Clamp player position to screen bounds
    player.x = Phaser.Math.Clamp(player.x, 0, config.width);

    // Ghost trigger check - spawn helper ghost when player is in danger
    if (player.x <= GHOST_TRIGGER_X && !ghostTriggered && colorQueue.length > 0) {
        ghostTriggered = true;
        spawnGhost.call(this);
    }

    // Reset ghost trigger when player recovers past midpoint
    if (player.x > gameOptions.playerStartX) {
        ghostTriggered = false;
    }

    // Update ghost if active
    if (ghostActive) {
        updateGhost.call(this, delta);
    }

    // Game Over if player is pushed off the left edge or falls
    if (player.x <= 0 || player.y > config.height + 50) {
        gameOver.call(this);
        return;
    }

    // Scroll backgrounds based on world speed
    const baseSpeed = worldSpeed * delta / 1000;

    // Scroll tileSprite layers
    // Sky is stationary (moon doesn't move)
    lightOverlay.tilePositionX += baseSpeed * 0.6;    // Light moves with near buildings
    roadTileSprite.tilePositionX += baseSpeed * 1.0;  // Road at full world speed

    // Move building sprites based on their layer's parallax speed
    ['far', 'mid', 'near'].forEach(layer => {
        const layerSpeed = baseSpeed * buildingConfig[layer].parallaxSpeed;
        buildingGroups[layer].getChildren().forEach(building => {
            if (building.active) {
                building.x -= layerSpeed;
            }
        });
    });

    // Spawn/recycle buildings as needed
    updateBuildingSpawns.call(this);

    // Landing check
    const onGround = player.body.blocked.down || player.body.touching.down;
    if (onGround && isJumping) {
        isJumping = false;
        jumpCount = 0;  // Reset double jump
        if (!isDucking) {
            player.setTexture('player_run1');
            runFrame = 0;       // Reset animation frame to prevent stutter
            runAnimTimer = 0;   // Reset animation timer
        }
    }

    // Update distance score based on character speed
    distanceScore += (characterSpeed * delta) / 1000;
    distanceText.setText(Math.floor(distanceScore).toString());

    // Run animation (2-frame loop with PNG sprites)
    if (onGround && !isDucking && !isJumping) {
        runAnimTimer += delta;
        if (runAnimTimer > 80) {
            runAnimTimer = 0;
            runFrame = (runFrame + 1) % 2;  // 2 frames instead of 4
            player.setTexture('player_run' + (runFrame + 1));
        }
    }

    // Update collectible velocities (animation is handled by sprite sheet)
    colorCollectibleGroup.getChildren().forEach(collectible => {
        if (collectible.active) {
            collectible.setVelocityX(-worldSpeed);
        }
    });

    // Update obstacle velocities
    obstacleGroup.getChildren().forEach(obstacle => {
        if (obstacle.active) {
            obstacle.setVelocityX(-worldSpeed);
        }
    });

    // Remove off-screen obstacles
    obstacleGroup.getChildren().forEach(obstacle => {
        if (obstacle.x < -100) {
            obstacle.setActive(false);
            obstacle.setVisible(false);
            obstacle.body.enable = false;
            obstacle.setVelocityX(0);
            obstacleGroup.remove(obstacle);
            obstaclePool.add(obstacle);
        }
    });

    // Remove off-screen collectibles
    colorCollectibleGroup.getChildren().forEach(collectible => {
        if (collectible.x < -50) {
            collectible.setActive(false);
            collectible.setVisible(false);
            collectible.body.enable = false;
            collectible.setVelocityX(0);
            colorCollectibleGroup.remove(collectible);
            colorCollectiblePool.add(collectible);
        }
    });

    // Update UI
    updatePieChart();
    updateImbalanceIndicator();

    // Update debug panel if visible
    if (debugVisible) {
        updateDebugPanel();
    }
}
