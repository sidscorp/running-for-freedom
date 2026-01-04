// Game configuration options
const gameOptions = {
    groundY: 404,  // Top of road (450 - 46 road height)
    playerStartX: 400,
    obstacleSpeed: 300,
    spawnInterval: [1500, 2500],
    jumpForce: 450,
    gravity: 1200,
    playerHeight: 48,
    playerWidth: 32,
    playerDuckHeight: 24,
    // Color collection system
    colorTypes: ['red', 'blue', 'green', 'yellow'],
    maxColorSegments: 13,
    maxPercentageDifference: 10,  // Percentage difference threshold for imbalance (strict!)
    baseSpeed: 300,
    characterBaseSpeed: 300,
    speedBonusPerUnit: 0,
    imbalancePenaltyMultiplier: 1,  // Forgiving - allows more flexibility in color balance
    colorSpawnInterval: [400, 900],
    unitsPerPickup: 10,
    maxSpeed: 800,  // Speed cap to prevent game from becoming unplayable
    syncThresholdX: 600,  // 75% of screen width (800px * 0.75)
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

    // --- Collectibles (bright but controlled) ---
    collectibleRed: 0xe84b4b,
    collectibleRedLight: 0xf08a8a,

    collectibleBlue: 0x4a7cff,
    collectibleBlueLight: 0x8fb0ff,

    collectibleGreen: 0x4ddc73,
    collectibleGreenLight: 0x8ff0ae,

    collectibleYellow: 0xe6d94c,
    collectibleYellowLight: 0xf2ec9a,

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
let playerSegmentContainer;
let playerSegments = [];  // Array of graphics objects for each segment
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
let pickupSound;

function preload() {
    createPixelCharacter.call(this);
    createObstacles.call(this);
    createColorCollectibles.call(this);
    createDeathParticles.call(this);

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
    this.load.audio('pickupSound', 'music/blink.wav');
}

// ============ PIXEL ART CREATION FUNCTIONS ============

function createPixelCharacter() {
    const scale = 1;
    createCharFrame.call(this, 'player_run1', scale, 'run1');
    createCharFrame.call(this, 'player_run2', scale, 'run2');
    createCharFrame.call(this, 'player_run3', scale, 'run3');
    createCharFrame.call(this, 'player_run4', scale, 'run4');
    createCharFrame.call(this, 'player_jump', scale, 'jump');
    createCharFrame.call(this, 'player_duck', scale, 'duck');
    createCharFrame.call(this, 'player_dead', scale, 'dead');
}

function createCharFrame(key, scale, pose) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const s = 2;

    if (pose === 'duck') {
        const w = 16 * s, h = 24 * s; // Full height to match other frames
        const yOff = 16 * s; // Push graphics to bottom
        
        g.fillStyle(colors.skin);
        g.fillRect(10*s, 0*s + yOff, 4*s, 4*s);
        g.fillStyle(colors.hair);
        g.fillRect(12*s, 0*s + yOff, 2*s, 2*s);
        g.fillStyle(colors.shirt);
        g.fillRect(4*s, 2*s + yOff, 8*s, 4*s);
        g.fillStyle(colors.pants);
        g.fillRect(0*s, 4*s + yOff, 6*s, 4*s);
        g.generateTexture(key, w, h);
    } else if (pose === 'dead') {
        const w = 16 * s, h = 24 * s;
        // Shirt
        g.fillStyle(colors.shirt);
        g.fillRect(4*s, 7*s, 8*s, 7*s);
        // Pants
        g.fillStyle(colors.pants);
        g.fillRect(4*s, 14*s, 8*s, 4*s);
        // Legs (collapsed)
        g.fillRect(2*s, 18*s, 4*s, 2*s);
        g.fillRect(10*s, 18*s, 4*s, 2*s);
        g.fillRect(0*s, 20*s, 2*s, 2*s); // feet
        g.fillRect(14*s, 20*s, 2*s, 2*s);
        
        // Blood spurts from neck
        g.fillStyle(0xcc0000);
        g.fillRect(6*s, 6*s, 4*s, 1*s);
        g.fillRect(5*s, 5*s, 1*s, 2*s);
        g.fillRect(10*s, 5*s, 1*s, 2*s);

        g.generateTexture(key, w, h);
    } else {
        const w = 16 * s, h = 24 * s;
        g.fillStyle(colors.hair);
        g.fillRect(5*s, 0*s, 6*s, 3*s);
        g.fillStyle(colors.skin);
        g.fillRect(5*s, 2*s, 6*s, 5*s);
        g.fillStyle(0x000000);
        g.fillRect(9*s, 3*s, 2*s, 2*s);
        g.fillStyle(colors.shirt);
        g.fillRect(4*s, 7*s, 8*s, 7*s);
        g.fillStyle(colors.skin);
        if (pose === 'jump') {
            g.fillRect(2*s, 5*s, 2*s, 4*s);
            g.fillRect(12*s, 5*s, 2*s, 4*s);
        } else {
            if (pose === 'run1' || pose === 'run3') {
                g.fillRect(2*s, 8*s, 2*s, 4*s);
                g.fillRect(12*s, 10*s, 2*s, 4*s);
            } else {
                g.fillRect(2*s, 10*s, 2*s, 4*s);
                g.fillRect(12*s, 8*s, 2*s, 4*s);
            }
        }
        g.fillStyle(colors.pants);
        g.fillRect(4*s, 14*s, 8*s, 4*s);
        if (pose === 'jump') {
            g.fillRect(4*s, 18*s, 3*s, 4*s);
            g.fillRect(9*s, 18*s, 3*s, 4*s);
        } else if (pose === 'run1') {
            g.fillRect(3*s, 18*s, 3*s, 6*s);
            g.fillRect(10*s, 18*s, 3*s, 4*s);
        } else if (pose === 'run2') {
            g.fillRect(5*s, 18*s, 3*s, 5*s);
            g.fillRect(8*s, 18*s, 3*s, 5*s);
        } else if (pose === 'run3') {
            g.fillRect(10*s, 18*s, 3*s, 6*s);
            g.fillRect(3*s, 18*s, 3*s, 4*s);
        } else if (pose === 'run4') {
            g.fillRect(5*s, 18*s, 3*s, 5*s);
            g.fillRect(8*s, 18*s, 3*s, 5*s);
        }
        g.fillStyle(0x222222);
        if (pose !== 'jump') {
            if (pose === 'run1') {
                g.fillRect(2*s, 22*s, 4*s, 2*s);
                g.fillRect(10*s, 20*s, 4*s, 2*s);
            } else if (pose === 'run3') {
                g.fillRect(10*s, 22*s, 4*s, 2*s);
                g.fillRect(2*s, 20*s, 4*s, 2*s);
            } else {
                g.fillRect(4*s, 21*s, 4*s, 2*s);
                g.fillRect(8*s, 21*s, 4*s, 2*s);
            }
        }
        g.generateTexture(key, w, h);
    }
    g.destroy();
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

function createColorCollectibles() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const s = 3;

    const colorData = [
        { name: 'red', main: colors.collectibleRed, light: colors.collectibleRedLight },
        { name: 'blue', main: colors.collectibleBlue, light: colors.collectibleBlueLight },
        { name: 'green', main: colors.collectibleGreen, light: colors.collectibleGreenLight },
        { name: 'yellow', main: colors.collectibleYellow, light: colors.collectibleYellowLight }
    ];

    colorData.forEach(color => {
        // Frame 1 - Full diamond
        g.fillStyle(color.main);
        g.fillRect(3*s, 0*s, 2*s, 1*s);
        g.fillRect(2*s, 1*s, 4*s, 1*s);
        g.fillRect(1*s, 2*s, 6*s, 1*s);
        g.fillRect(0*s, 3*s, 8*s, 2*s);
        g.fillRect(1*s, 5*s, 6*s, 1*s);
        g.fillRect(2*s, 6*s, 4*s, 1*s);
        g.fillRect(3*s, 7*s, 2*s, 1*s);
        g.fillStyle(color.light);
        g.fillRect(2*s, 2*s, 2*s, 2*s);
        g.generateTexture('collectible_' + color.name + '_1', 8*s, 8*s);
        g.clear();

        // Frame 2 - Slightly narrower
        g.fillStyle(color.main);
        g.fillRect(3*s, 0*s, 2*s, 1*s);
        g.fillRect(2*s, 1*s, 4*s, 6*s);
        g.fillRect(3*s, 7*s, 2*s, 1*s);
        g.fillStyle(color.light);
        g.fillRect(2*s, 2*s, 2*s, 2*s);
        g.generateTexture('collectible_' + color.name + '_2', 8*s, 8*s);
        g.clear();

        // Frame 3 - Thin edge
        g.fillStyle(color.main);
        g.fillRect(3*s, 0*s, 2*s, 8*s);
        g.fillStyle(color.light);
        g.fillRect(3*s, 1*s, 1*s, 2*s);
        g.generateTexture('collectible_' + color.name + '_3', 8*s, 8*s);
        g.clear();

        // Frame 4 - Back to slightly narrow
        g.fillStyle(color.main);
        g.fillRect(3*s, 0*s, 2*s, 1*s);
        g.fillRect(2*s, 1*s, 4*s, 6*s);
        g.fillRect(3*s, 7*s, 2*s, 1*s);
        g.fillStyle(color.light);
        g.fillRect(4*s, 2*s, 2*s, 2*s);
        g.generateTexture('collectible_' + color.name + '_4', 8*s, 8*s);
        g.clear();
    });

    g.destroy();
}

// ============ DEBUG PANEL ============

function createDebugPanel() {
    debugContainer = this.add.container(590, 10);
    debugContainer.setDepth(150);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, 200, 200);
    debugContainer.add(bg);

    // Title
    const title = this.add.text(100, 8, 'DEBUG PANEL', {
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
    divider.moveTo(10, 28);
    divider.lineTo(190, 28);
    divider.strokePath();
    debugContainer.add(divider);

    // Text elements
    const textStyle = {
        fontSize: '11px',
        fill: '#ffffff',
        fontFamily: 'monospace'
    };

    let yPos = 35;
    const lineHeight = 16;

    debugTexts.characterSpeed = this.add.text(10, yPos, 'SPD: 0', textStyle);
    debugContainer.add(debugTexts.characterSpeed);
    yPos += lineHeight;

    debugTexts.worldSpeed = this.add.text(10, yPos, 'WLD: 0', textStyle);
    debugContainer.add(debugTexts.worldSpeed);
    yPos += lineHeight;

    debugTexts.position = this.add.text(10, yPos, 'POS: (0, 0)', textStyle);
    debugContainer.add(debugTexts.position);
    yPos += lineHeight;

    debugTexts.colorsLine1 = this.add.text(10, yPos, 'R:00  B:00', textStyle);
    debugContainer.add(debugTexts.colorsLine1);
    yPos += lineHeight;

    debugTexts.colorsLine2 = this.add.text(10, yPos, 'G:00  Y:00', textStyle);
    debugContainer.add(debugTexts.colorsLine2);
    yPos += lineHeight;

    debugTexts.penalty = this.add.text(10, yPos, 'PENALTY: 0', textStyle);
    debugContainer.add(debugTexts.penalty);
    yPos += lineHeight;

    debugTexts.bonus = this.add.text(10, yPos, 'BONUS: 0', textStyle);
    debugContainer.add(debugTexts.bonus);
    yPos += lineHeight;

    debugTexts.differential = this.add.text(10, yPos, 'DIFF: 0 (0%)', textStyle);
    debugContainer.add(debugTexts.differential);

    // Initially hidden
    debugContainer.setVisible(false);
}

function updateDebugPanel() {
    debugTexts.characterSpeed.setText('SPD: ' + Math.round(characterSpeed));
    debugTexts.worldSpeed.setText('WLD: ' + Math.round(worldSpeed));
    debugTexts.position.setText('POS: (' + Math.round(player.x) + ', ' + Math.round(player.y) + ')');

    // Calculate color counts and percentages from queue
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    colorQueue.forEach(color => counts[color]++);

    debugTexts.colorsLine1.setText('R:' + String(counts.red).padStart(2, '0') + '  B:' + String(counts.blue).padStart(2, '0'));
    debugTexts.colorsLine2.setText('G:' + String(counts.green).padStart(2, '0') + '  Y:' + String(counts.yellow).padStart(2, '0'));

    debugTexts.penalty.setText('PENALTY: ' + Math.round(currentPenalty));
    debugTexts.bonus.setText('BONUS: ' + timeSpeedBonus);

    // Calculate and display differential
    const diff = worldSpeed - characterSpeed;
    const diffPercent = characterSpeed > 0 ? Math.round((diff / characterSpeed) * 100) : 0;
    debugTexts.differential.setText('DIFF: ' + Math.round(diff) + ' (' + diffPercent + '%)');

    // Color coding
    if (currentPenalty > 0) {
        debugTexts.penalty.setFill('#ff6666');
    } else {
        debugTexts.penalty.setFill('#ffffff');
    }

    if (timeSpeedBonus > 0) {
        debugTexts.bonus.setFill('#66ff66');
    } else {
        debugTexts.bonus.setFill('#ffffff');
    }

    if (player.x >= gameOptions.syncThresholdX * 0.9) {
        debugTexts.position.setFill('#ffff66');
    } else {
        debugTexts.position.setFill('#ffffff');
    }

    // Color code differential (negative = falling behind)
    if (diff > 0) {
        debugTexts.differential.setFill('#ff6666');  // Red = falling behind
    } else if (diff < 0) {
        debugTexts.differential.setFill('#66ff66');  // Green = ahead
    } else {
        debugTexts.differential.setFill('#ffffff');  // White = balanced
    }
}

function toggleDebugPanel() {
    debugVisible = !debugVisible;
    debugContainer.setVisible(debugVisible);
}

function createHelpBox() {
    const helpContainer = this.add.container(10, 10);
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
        'DOWN: Duck',
        'P: Pause',
        'M: Toggle Music',
        'O: Toggle Obstacles',
        'D: Debug Panel'
    ];

    controls.forEach(control => {
        const text = this.add.text(10, yPos, control, textStyle);
        helpContainer.add(text);
        yPos += lineHeight;
    });
}

function createStartScreen() {
    startContainer = this.add.container(400, 225);
    startContainer.setDepth(250);

    // Background with neon border
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.95);
    bg.fillRect(-350, -200, 700, 400);
    // Neon cyan border
    bg.lineStyle(3, 0x00d1cc, 1);
    bg.strokeRect(-350, -200, 700, 400);
    // Inner glow effect
    bg.lineStyle(1, 0x00d1cc, 0.5);
    bg.strokeRect(-347, -197, 694, 394);
    startContainer.add(bg);

    // Title with neon glow
    const title = this.add.text(0, -140, 'ENDLESS RUNNER', {
        fontSize: '52px',
        fill: '#00d1cc',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        shadow: {
            offsetX: 0,
            offsetY: 0,
            color: '#00d1cc',
            blur: 15,
            fill: true
        }
    });
    title.setOrigin(0.5);
    startContainer.add(title);

    // Instructions
    const instructions = [
        'COLLECT COLORS TO GAIN SPEED',
        'KEEP COLORS BALANCED',
        '',
        'SPACE: Jump (Double Jump)',
        'DOWN: Duck',
        'M: Music  |  O: Obstacles',
        'P: Pause  |  D: Debug Panel'
    ];

    let yPos = -60;
    instructions.forEach((line, index) => {
        const textStyle = {
            fontSize: line === '' ? '8px' : (index < 2 ? '14px' : '12px'),
            fill: index < 2 ? '#ffffff' : '#aaaaaa',
            fontFamily: 'monospace',
            fontStyle: index < 2 ? 'bold' : 'normal'
        };
        const text = this.add.text(0, yPos, line, textStyle);
        text.setOrigin(0.5);
        startContainer.add(text);
        yPos += line === '' ? 8 : (index < 2 ? 22 : 18);
    });

    // Start prompt with pulsing effect
    const startPrompt = this.add.text(0, 140, 'PRESS SPACE OR CLICK TO START', {
        fontSize: '18px',
        fill: '#00ff00',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        shadow: {
            offsetX: 0,
            offsetY: 0,
            color: '#00ff00',
            blur: 10,
            fill: true
        }
    });
    startPrompt.setOrigin(0.5);
    startContainer.add(startPrompt);

    // Pulsing animation
    this.tweens.add({
        targets: startPrompt,
        alpha: 0.3,
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

    // Background with neon border
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.95);
    bg.fillRect(-300, -180, 600, 360);
    // Neon red border
    bg.lineStyle(3, 0xff2e63, 1);
    bg.strokeRect(-300, -180, 600, 360);
    // Inner glow effect
    bg.lineStyle(1, 0xff2e63, 0.5);
    bg.strokeRect(-297, -177, 594, 354);
    gameOverContainer.add(bg);

    // Game Over title with neon glow
    const title = this.add.text(0, -120, 'GAME OVER', {
        fontSize: '56px',
        fill: '#ff2e63',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        shadow: {
            offsetX: 0,
            offsetY: 0,
            color: '#ff2e63',
            blur: 20,
            fill: true
        }
    });
    title.setOrigin(0.5);
    gameOverContainer.add(title);

    // Distance label
    const distanceLabel = this.add.text(0, -20, 'DISTANCE', {
        fontSize: '20px',
        fill: '#888888',
        fontFamily: 'monospace'
    });
    distanceLabel.setOrigin(0.5);
    gameOverContainer.add(distanceLabel);

    // Score value (will be updated when shown)
    const scoreValue = this.add.text(0, 30, '0', {
        fontSize: '64px',
        fill: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        shadow: {
            offsetX: 0,
            offsetY: 0,
            color: '#ffffff',
            blur: 10,
            fill: true
        }
    });
    scoreValue.setOrigin(0.5);
    scoreValue.setName('scoreValue');
    gameOverContainer.add(scoreValue);

    // Restart button with neon effect
    const restartButton = this.add.graphics();
    restartButton.fillStyle(0x000000, 1);
    restartButton.fillRect(-120, 100, 240, 50);
    // Neon green border
    restartButton.lineStyle(3, 0x00ff00, 1);
    restartButton.strokeRect(-120, 100, 240, 50);
    // Inner glow
    restartButton.lineStyle(1, 0x00ff00, 0.5);
    restartButton.strokeRect(-117, 103, 234, 44);
    gameOverContainer.add(restartButton);

    // Restart text
    const restartText = this.add.text(0, 125, 'RESTART', {
        fontSize: '24px',
        fill: '#00ff00',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        shadow: {
            offsetX: 0,
            offsetY: 0,
            color: '#00ff00',
            blur: 10,
            fill: true
        }
    });
    restartText.setOrigin(0.5);
    restartText.setName('restartText');
    gameOverContainer.add(restartText);

    // Pulsing animation for restart button
    this.tweens.add({
        targets: restartText,
        alpha: 0.5,
        duration: 600,
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
    playerSegmentContainer.setVisible(true);

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
    colorQueue = [];  // Reset to empty queue
    playerSegments = [];  // Reset segments array
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

    // Create pickup sound if not already created
    if (!pickupSound) {
        pickupSound = this.sound.add('pickupSound', {
            volume: 0.3,
            rate: 2.0  // 2x speed for quick, snappy pickup sound
        });
    }

    // Create PNG-based background system (sky, buildings, light, road)
    createBackgroundSystem.call(this);

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
    player.setGravityY(gameOptions.gravity);
    
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
    this.input.keyboard.on('keydown-DOWN', startDuck, this);
    this.input.keyboard.on('keydown-S', startDuck, this);
    this.input.keyboard.on('keyup-DOWN', stopDuck, this);
    this.input.keyboard.on('keyup-S', stopDuck, this);
    this.input.keyboard.on('keydown-P', togglePause, this);
    this.input.keyboard.on('keydown-O', toggleObstacles, this);
    this.input.keyboard.on('keydown-D', toggleDebugPanel, this);
    this.input.keyboard.on('keydown-M', toggleMusic, this);

    // DON'T start spawning immediately - wait for startGame() to be called

    // Create player segments
    createPlayerSegments.call(this);

    // Imbalance indicator
    imbalanceGraphics = this.add.graphics();
    imbalanceGraphics.setDepth(50);

    // Speed indicator removed - use debug panel (D key) for speed info

    // Distance/Score display (hidden initially - shown when game starts)
    distanceText = this.add.text(780, 16, 'DISTANCE: 0', {
        fontSize: '14px',
        fill: '#ffffff',
        fontFamily: 'monospace'
    });
    distanceText.setOrigin(1, 0);
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

function createPlayerSegments() {
    const segmentWidth = gameOptions.playerWidth;  // 32px
    const segmentHeight = 3.5;
    const segmentSpacing = 0.5;
    const totalHeight = (segmentHeight + segmentSpacing) * maxSegments;

    playerSegmentContainer = this.add.container(player.x, player.y - 70);
    playerSegmentContainer.setDepth(15);

    // Color hex map
    const colorHexMap = {
        red: colors.collectibleRed,
        blue: colors.collectibleBlue,
        green: colors.collectibleGreen,
        yellow: colors.collectibleYellow
    };

    // Create 13 segment graphics (bottom to top, index 0 is bottom/oldest)
    for (let i = 0; i < maxSegments; i++) {
        const y = -(i * (segmentHeight + segmentSpacing));  // Stack upward from 0

        const segment = this.add.graphics();
        segment.segmentIndex = i;
        segment.yPos = y;

        // Draw empty segment initially
        segment.fillStyle(0x333333, 0.3);
        segment.fillRect(-segmentWidth / 2, y, segmentWidth, segmentHeight);

        playerSegmentContainer.add(segment);
        playerSegments.push(segment);
    }

    // Hide initially - will be shown when game starts
    playerSegmentContainer.setVisible(false);
}

function updatePlayerSegments() {
    const colorHexMap = {
        red: colors.collectibleRed,
        blue: colors.collectibleBlue,
        green: colors.collectibleGreen,
        yellow: colors.collectibleYellow
    };

    // Update each segment based on colorQueue
    for (let i = 0; i < maxSegments; i++) {
        const segment = playerSegments[i];
        const segmentWidth = gameOptions.playerWidth;
        const segmentHeight = 3.5;
        const y = segment.yPos;

        // Clear and redraw
        segment.clear();

        if (i < colorQueue.length) {
            // Filled segment - show color from queue
            const color = colorQueue[i];
            segment.fillStyle(colorHexMap[color], 1);
            segment.fillRect(-segmentWidth / 2, y, segmentWidth, segmentHeight);
        } else {
            // Empty segment - show transparent gray
            segment.fillStyle(0x333333, 0.3);
            segment.fillRect(-segmentWidth / 2, y, segmentWidth, segmentHeight);
        }
    }

    // Follow player position
    playerSegmentContainer.x = player.x;
    playerSegmentContainer.y = player.y - 70;
}

// ============ SPEED & BALANCE SYSTEM ============

function calculateCharacterSpeed() {
    const total = colorQueue.length;
    const speedBonus = total * gameOptions.speedBonusPerUnit;
    const penalty = calculateImbalancePenalty();

    // Character speed increases with time and collection bonus, reduced by imbalance penalty
    let speed = gameOptions.characterBaseSpeed + speedBonus + timeSpeedBonus - penalty;

    // Cap at max speed (same as world speed cap)
    speed = Math.min(gameOptions.maxSpeed, speed);

    // Clamp to 0 minimum
    characterSpeed = Math.max(0, speed);

    // Store penalty globally for debug display
    currentPenalty = penalty;

    return penalty;
}

function calculateWorldSpeed() {
    const total = colorQueue.length;
    const speedBonus = total * gameOptions.speedBonusPerUnit;

    // World speed increases with time (and collection bonus if enabled)
    let speed = gameOptions.baseSpeed + speedBonus + timeSpeedBonus;

    // Cap at max speed
    speed = Math.min(gameOptions.maxSpeed, speed);

    // Update global worldSpeed (clamped to 0 for physics/visuals)
    worldSpeed = Math.max(0, speed);
}

function calculateImbalancePenalty() {
    // No penalty if queue is empty
    if (colorQueue.length === 0) {
        isImbalanced = false;
        return 0;
    }

    // Count each color's occurrences in the queue
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    colorQueue.forEach(color => counts[color]++);

    // Count how many unique colors we have
    const uniqueColors = Object.values(counts).filter(count => count > 0).length;

    // No penalty if we have less than 2 different colors
    // (can't be "imbalanced" with only one color type)
    if (uniqueColors < 2) {
        isImbalanced = false;
        return 0;
    }

    // Calculate percentages only for colors that exist (ignore 0% colors)
    const total = colorQueue.length;
    const collectedPercentages = [];

    for (const color in counts) {
        if (counts[color] > 0) {
            collectedPercentages.push((counts[color] / total) * 100);
        }
    }

    // Find max and min percentages among collected colors only
    const maxPercent = Math.max(...collectedPercentages);
    const minPercent = Math.min(...collectedPercentages);
    const difference = maxPercent - minPercent;

    // Calculate penalty if imbalanced
    if (difference > gameOptions.maxPercentageDifference) {
        isImbalanced = true;
        return (difference - gameOptions.maxPercentageDifference) * gameOptions.imbalancePenaltyMultiplier;
    }

    isImbalanced = false;
    return 0;
}

function updateImbalanceIndicator() {
    imbalanceGraphics.clear();

    if (isImbalanced) {
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
    const textureKey = 'collectible_' + colorType + '_1';

    let collectible;
    const pooled = colorCollectiblePool.getChildren().find(c => c.colorType === colorType);

    if (pooled) {
        collectible = pooled;
        resetPooledObject(collectible);  // Reset all properties before reuse
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
    collectible.setDepth(8);  // Between ground layers and player (depth 10)

    // Random height: from ground level (runnable) to jump height
    // Range extends to very low positions to prevent duck exploit
    const minY = gameOptions.groundY - 200;  // High point (jump to reach)
    const maxY = gameOptions.groundY - 10;   // Very low point (below duck height)
    collectible.y = Phaser.Math.Between(minY, maxY);
    collectible.setVelocityX(-worldSpeed);
    collectible.animFrame = 0;
    collectible.animTimer = 0;
}

function selectColorToSpawn() {
    // 100% weighted toward most collected (no random - very hard to balance!)
    // Calculate counts from queue for weighted selection
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
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
    return 'red';
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

    updatePlayerSegments();
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

function startDuck() {
    const onGround = player.body.blocked.down || player.body.touching.down;
    if (onGround && !isJumping) {
        isDucking = true;
        player.setTexture('player_duck');
        player.body.setSize(32, gameOptions.playerDuckHeight);
        player.body.setOffset(0, 24);
    }
}

function stopDuck() {
    if (isDucking) {
        isDucking = false;
        player.setTexture('player_run1');
        player.body.setSize(32, gameOptions.playerHeight);
        player.body.setOffset(0, 0);
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
    this.input.keyboard.off('keydown-DOWN', startDuck, this);
    this.input.keyboard.off('keydown-S', startDuck, this);
    this.input.keyboard.off('keyup-DOWN', stopDuck, this);
    this.input.keyboard.off('keyup-S', stopDuck, this);
    this.input.keyboard.off('keydown-P', togglePause, this);
    this.input.keyboard.off('keydown-O', toggleObstacles, this);
    this.input.keyboard.off('keydown-D', toggleDebugPanel, this);
    this.input.keyboard.off('keydown-M', toggleMusic, this);

    // Remove restart listeners
    this.input.off('pointerdown', restartGame, this);
    this.input.keyboard.off('keydown-SPACE', restartGame, this);

    // Kill all active tweens to prevent them corrupting recycled objects
    this.tweens.killAll();

    // Reset game state
    slowSpeedTimer = 0;

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

    // Move player forward based on character speed
    const characterMovement = (characterSpeed * delta) / 1000;
    const worldMovement = (worldSpeed * delta) / 1000;

    // Net movement: character moves forward, world moves backward (relative to player)
    player.x += characterMovement - worldMovement;

    // Check if player has reached the sync threshold (75% of screen)
    if (player.x >= gameOptions.syncThresholdX) {
        // Just reset position, don't update base speeds (prevents exponential growth bug)
        player.x = gameOptions.playerStartX;
    }

    // Clamp player position to screen bounds
    player.x = Phaser.Math.Clamp(player.x, 0, config.width);

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
    distanceText.setText('DISTANCE: ' + Math.floor(distanceScore));

    // Run animation
    if (onGround && !isDucking && !isJumping) {
        runAnimTimer += delta;
        if (runAnimTimer > 80) {
            runAnimTimer = 0;
            runFrame = (runFrame + 1) % 4;
            player.setTexture('player_run' + (runFrame + 1));
        }
    }

    // Animate collectibles
    colorCollectibleGroup.getChildren().forEach(collectible => {
        if (collectible.active) {
            collectible.animTimer = (collectible.animTimer || 0) + delta;
            if (collectible.animTimer > 120) {
                collectible.animTimer = 0;
                collectible.animFrame = ((collectible.animFrame || 0) + 1) % 4;
                collectible.setTexture('collectible_' + collectible.colorType + '_' + (collectible.animFrame + 1));
            }
            // Update velocity to match current speed
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
    updatePlayerSegments();
    updateImbalanceIndicator();

    // Update debug panel if visible
    if (debugVisible) {
        updateDebugPanel();
    }
}
