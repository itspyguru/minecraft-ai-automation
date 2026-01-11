# AIBot Commands Reference

Complete list of all available commands for your Minecraft AI bot.

---

## Direct Commands

These are simple commands that trigger immediate actions without AI processing.

### `follow`
Bot will intelligently follow you using smart pathfinding.
- Maintains 2-block distance
- Navigates around obstacles
- Works across any terrain

**Example:**
```
follow
```

---

### `stop`
Stops all current bot activities (following, mining, pathfinding).

**Example:**
```
stop
```

---

### `mine [block_type]`
Find and mine the nearest block of specified type within 32 blocks.

**Examples:**
```
mine log
mine stone
mine dirt
mine coal
mine diamond
```

**Note:** If no block type specified, defaults to "log"

---

### `build [structure] [material]`
Construct predefined structures automatically. The bot will place blocks to create the structure at its current location.

**Available Structures:**
- `house` - Small 5x5 house with walls, roof, and doorway
- `wall` - 10 blocks long, 3 blocks high straight wall
- `tower` - 3x3 hollow tower, 10 blocks tall
- `platform` - 7x7 flat platform
- `pillar` - Single pillar 5 blocks high

**Materials:** planks (default), stone, cobblestone, brick, oak_planks, etc.

**Examples:**
```
build house
build house stone
build wall cobblestone
build tower brick
build platform
```

**Requirements:**
- Must have building materials in inventory
- Needs clear space to build
- Bot will move around to place blocks

---

### `structures`
Lists all available structures with descriptions.

**Example:**
```
structures
```

---

### `state` or `status`
Displays bot's current state including position, health, food, and inventory.

**Examples:**
```
state
status
```

**Output:**
- Position coordinates
- Health and food levels
- Number of items in inventory
- Full JSON state in console

---

### `come`
Simple forward movement for 3 seconds (legacy command).

**Example:**
```
come
```

---

## AI-Powered Commands

Use natural language with the `ai` prefix for intelligent actions powered by GPT-4o-mini.

### `ai [your request]`
Give natural language instructions to the bot. The AI will analyze the game state and execute the appropriate action.

---

### AI Command Examples

#### Mining & Gathering
```
ai mine stone
ai mine 3 stones
ai get some wood
ai gather logs
ai collect dirt
ai find coal
ai mine diamonds
```

#### Movement & Following
```
ai follow me
ai come here
ai go to coordinates 100 64 200
ai goto 50 70 -30
ai stop moving
```

#### Communication
```
ai say hello
ai say hello everyone
ai tell everyone I found diamonds
ai chat Hi there!
```

#### Building Structures
```
ai build a house
ai build house
ai build stone wall
ai make a tower
ai build platform
ai construct a pillar
ai build wall with cobblestone
```

#### Combining Actions
```
ai follow me and mine logs
ai gather wood then come back
ai mine stone near me
ai build house then follow me
```

---

## Available Block Types

Common blocks you can mine:

### Nature
- `log` - Wood/tree logs
- `dirt` - Dirt blocks
- `grass` - Grass blocks
- `sand` - Sand blocks
- `gravel` - Gravel blocks

### Stone & Ores
- `stone` - Stone blocks
- `cobblestone` - Cobblestone
- `coal` - Coal ore
- `iron` - Iron ore
- `gold` - Gold ore
- `diamond` - Diamond ore
- `emerald` - Emerald ore
- `redstone` - Redstone ore
- `lapis` - Lapis lazuli ore

### Other
- `leaves` - Tree leaves
- `planks` - Wooden planks
- `wool` - Wool blocks

---

## How AI Commands Work

1. **You type:** `ai mine stone`
2. **Bot receives:** Your command + current game state
3. **AI analyzes:** Position, health, inventory, nearby blocks
4. **AI decides:** Best action to take
5. **Bot executes:** The action (mining, moving, chatting)

The AI can understand variations and context:
- "mine stone" = "get stone" = "gather stone" = "collect stone"
- "follow me" = "come here" = "follow player"

---

## Tips & Tricks

### Efficient Mining
```
ai mine log    # Finds nearest tree
stop           # Cancel if it's going too far
ai mine stone  # Mine something else
```

### Following While Mining
```
follow         # Start following
ai mine dirt   # Will try to mine while following
```

### Check Bot Status
```
state          # Quick status check
ai state       # AI can also report status
```

### Emergency Stop
```
stop           # Immediate stop for any action
```

---

## Technical Details

### AI Actions Available
The AI can choose from these actions:

1. **Follow:** `{"action": "follow", "target": "username"}`
2. **Stop:** `{"action": "stop"}`
3. **Mine:** `{"action": "mine", "blockType": "stone"}`
4. **Chat:** `{"action": "chat", "message": "text"}`
5. **Goto:** `{"action": "goto", "x": 0, "y": 0, "z": 0}`
6. **Build:** `{"action": "build", "structure": "house", "material": "planks"}`

### Pathfinding
- Uses mineflayer-pathfinder for intelligent navigation
- Avoids obstacles, water, lava
- Climbs stairs and ladders
- Jumps gaps when safe

### Mining Range
- Searches within 32 blocks
- Will pathfind to the block location
- Mines automatically when reached

### Building System
- **5 Predefined Structures:** house, wall, tower, platform, pillar
- Bot places blocks one by one to form complete structures
- Automatically navigates to reach build positions
- Progress updates every 10 blocks
- Checks inventory for materials before starting
- Builds from bottom to top for stability

**Structure Sizes:**
- **House:** 5x5x4 blocks (floor, walls, roof with door)
- **Wall:** 10x3 blocks (straight defensive wall)
- **Tower:** 3x3x10 blocks (hollow tower you can climb)
- **Platform:** 7x7 flat surface
- **Pillar:** 1x1x5 column

---

## Troubleshooting

### Bot Not Responding
- Check console for errors
- Ensure bot is spawned in game
- Verify API key in `.env` file

### Mining Fails
- Block might be out of range (>32 blocks)
- Block type spelling matters (use "log" not "wood")
- Bot needs direct line of sight to block

### AI Commands Not Working
- Check OpenAI API key is valid
- Look for "[AI ERROR]" in console
- Try direct commands instead (`mine`, `follow`)

---

## Need Help?

Check the console output for:
- `[CHAT]` - All chat messages
- `[AI]` - AI processing logs
- `[EXECUTE]` - Actions being executed
- `[STATE]` - Full game state data

The bot logs everything for debugging!
