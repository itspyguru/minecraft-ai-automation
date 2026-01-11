const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const OpenAI = require('openai')
require('dotenv').config()

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'AIBot'
})

// Load pathfinder plugin
bot.loadPlugin(pathfinder)

bot.once('spawn', () => {
  console.log('🤖 AIBot spawned')

  // Set up pathfinder with minecraft data
  const mcData = require('minecraft-data')(bot.version)
  bot.pathfinder.setMovements(new Movements(bot, mcData))

  bot.chat('AIBot ready! Commands: ai [request], follow, mine, build, structures')
})

// Game state tracking function - returns current bot state
function getState() {
  return {
    position: {
      x: bot.entity.position.x.toFixed(2),
      y: bot.entity.position.y.toFixed(2),
      z: bot.entity.position.z.toFixed(2)
    },
    health: bot.health,
    food: bot.food,
    oxygen: bot.oxygenLevel,
    inventory: bot.inventory.items().map(item => ({
      name: item.name,
      count: item.count,
      slot: item.slot
    })),
    nearbyBlocks: getNearbyBlocksSummary(),
    nearbyPlayers: Object.keys(bot.players).filter(name => name !== bot.username)
  }
}

// Helper function to get summary of nearby blocks
function getNearbyBlocksSummary() {
  const blocks = {}
  const radius = 5

  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const block = bot.blockAt(bot.entity.position.offset(x, y, z))
        if (block && block.name !== 'air') {
          blocks[block.name] = (blocks[block.name] || 0) + 1
        }
      }
    }
  }

  return blocks
}

// AI Controller - sends game state to GPT and gets action
async function askAI(userMessage) {
  const state = getState()

  const systemPrompt = `You are an AI controlling a Minecraft bot. Analyze the user's request and respond with a JSON action.

AVAILABLE ACTIONS:
1. Follow player: {"action": "follow", "target": "username"}
2. Stop all: {"action": "stop"}
3. Mine block: {"action": "mine", "blockType": "stone"}
4. Chat: {"action": "chat", "message": "Hello!"}
5. Go to location: {"action": "goto", "x": 100, "y": 64, "z": 200}
6. Build structure: {"action": "build", "structure": "house", "material": "planks"}

AVAILABLE STRUCTURES:
- house: Small 5x5 house with walls, roof, and doorway
- wall: 10 blocks long, 3 blocks high straight wall
- tower: 3x3 hollow tower, 10 blocks tall
- platform: 7x7 flat platform
- pillar: Single pillar 5 blocks high

EXAMPLES:
User: "follow me" → {"action": "follow", "target": "username"}
User: "mine stone" → {"action": "mine", "blockType": "stone"}
User: "mine 3 stones" → {"action": "mine", "blockType": "stone"}
User: "get some wood" → {"action": "mine", "blockType": "log"}
User: "build a house" → {"action": "build", "structure": "house", "material": "planks"}
User: "build stone wall" → {"action": "build", "structure": "wall", "material": "stone"}
User: "make a tower" → {"action": "build", "structure": "tower", "material": "planks"}
User: "build platform" → {"action": "build", "structure": "platform", "material": "stone"}
User: "stop" → {"action": "stop"}
User: "say hello" → {"action": "chat", "message": "Hello!"}

IMPORTANT RULES:
- For mining: use blockType without numbers (stone, log, dirt, coal, iron, diamond)
- For building: structure must be one of (house, wall, tower, platform, pillar)
- Default material is "planks" if not specified
- Material can be: planks, stone, cobblestone, brick, wood, oak_planks, etc.
- Always try to fulfill the user's request with an action
- Only use "stop" if explicitly asked to stop

Current game state:
${JSON.stringify(state, null, 2)}

Return ONLY valid JSON, nothing else.`

  try {
    console.log('[AI] Asking GPT-4o-mini:', userMessage)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: {"type": "json_object"}
    })

    const response = completion.choices[0].message.content
    console.log('[AI] GPT response:', response)

    return JSON.parse(response)
  } catch (error) {
    console.error('[AI ERROR]', error)
    return { action: 'chat', message: 'AI error occurred' }
  }
}

// Execute actions from AI
async function executeAction(action, username) {
  console.log('[EXECUTE]', action)

  switch (action.action) {
    case 'follow':
      const target = bot.players[action.target || username]?.entity
      if (!target) {
        bot.chat('Cannot see target player')
        return
      }
      bot.chat(`Following ${action.target || username}`)
      bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
      break

    case 'stop':
      bot.pathfinder.setGoal(null)
      bot.chat('Stopped')
      break

    case 'mine':
      const block = bot.findBlock({
        matching: (block) => block.name.includes(action.blockType),
        maxDistance: 32
      })
      if (!block) {
        bot.chat(`No ${action.blockType} found`)
        return
      }
      bot.chat(`Mining ${block.name}...`)
      const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z)
      bot.pathfinder.setGoal(goal)
      bot.once('goal_reached', async () => {
        try {
          await bot.dig(block)
          bot.chat(`Mined ${block.name}!`)
        } catch (err) {
          bot.chat(`Mining failed: ${err.message}`)
        }
      })
      break

    case 'goto':
      bot.chat(`Going to (${action.x}, ${action.y}, ${action.z})`)
      bot.pathfinder.setGoal(new goals.GoalBlock(action.x, action.y, action.z))
      break

    case 'chat':
      bot.chat(action.message)
      break

    case 'build':
      await buildStructure(action.structure, action.material || 'planks')
      break

    default:
      bot.chat('Unknown action')
  }
}

// Building System - Structures and placement

// Building templates - relative positions [x, y, z] from starting point
const buildingTemplates = {
  house: {
    description: 'Small 5x5 house with walls and roof',
    blocks: [
      // Floor (5x5)
      ...Array.from({length: 5}, (_, x) =>
        Array.from({length: 5}, (_, z) => [x, 0, z])
      ).flat(),

      // Walls (height 3)
      // Front and back walls
      ...Array.from({length: 3}, (_, y) => [
        [0, y+1, 0], [1, y+1, 0], [2, y+1, 0], [3, y+1, 0], [4, y+1, 0],
        [0, y+1, 4], [1, y+1, 4], [2, y+1, 4], [3, y+1, 4], [4, y+1, 4]
      ]).flat(),

      // Side walls (excluding corners already placed)
      ...Array.from({length: 3}, (_, y) => [
        [0, y+1, 1], [0, y+1, 2], [0, y+1, 3],
        [4, y+1, 1], [4, y+1, 2], [4, y+1, 3]
      ]).flat(),

      // Roof (flat)
      ...Array.from({length: 5}, (_, x) =>
        Array.from({length: 5}, (_, z) => [x, 4, z])
      ).flat()
    ],
    doorway: [[2, 1, 0], [2, 2, 0]] // Leave door opening
  },

  wall: {
    description: 'Straight wall 10 blocks long, 3 blocks high',
    blocks: Array.from({length: 10}, (_, x) =>
      Array.from({length: 3}, (_, y) => [x, y, 0])
    ).flat()
  },

  tower: {
    description: '3x3 tower, 10 blocks high',
    blocks: [
      // Hollow tower with walls
      ...Array.from({length: 10}, (_, y) => [
        // Outer perimeter at each level
        [0, y, 0], [1, y, 0], [2, y, 0],
        [0, y, 1],           [2, y, 1],
        [0, y, 2], [1, y, 2], [2, y, 2]
      ]).flat()
    ]
  },

  platform: {
    description: '7x7 flat platform',
    blocks: Array.from({length: 7}, (_, x) =>
      Array.from({length: 7}, (_, z) => [x, 0, z])
    ).flat()
  },

  pillar: {
    description: 'Single pillar 5 blocks high',
    blocks: Array.from({length: 5}, (_, y) => [0, y, 0])
  }
}

// Place a single block at position
async function placeBlock(x, y, z, blockName) {
  try {
    const mcData = require('minecraft-data')(bot.version)

    // Find the block item in inventory
    const blockItem = bot.inventory.items().find(item =>
      item.name.includes(blockName) || blockName.includes(item.name)
    )

    if (!blockItem) {
      return { success: false, error: `No ${blockName} in inventory` }
    }

    // Equip the block
    await bot.equip(blockItem, 'hand')

    // Check if position is already occupied
    const targetBlock = bot.blockAt(new (require('vec3'))(x, y, z))
    if (targetBlock && targetBlock.name !== 'air') {
      return { success: false, error: 'Position occupied' }
    }

    // Find reference block to place against
    const refBlock = bot.blockAt(new (require('vec3'))(x, y - 1, z))
    if (!refBlock || refBlock.name === 'air') {
      return { success: false, error: 'No surface to build on' }
    }

    // Place the block
    await bot.placeBlock(refBlock, new (require('vec3'))(0, 1, 0))

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Build a complete structure
async function buildStructure(structureName, material = 'planks') {
  const template = buildingTemplates[structureName]

  if (!template) {
    bot.chat(`Unknown structure: ${structureName}`)
    bot.chat(`Available: ${Object.keys(buildingTemplates).join(', ')}`)
    return
  }

  bot.chat(`Building ${structureName}...`)
  console.log(`[BUILD] Starting ${structureName} with ${material}`)

  // Check inventory
  const materialItem = bot.inventory.items().find(item =>
    item.name.includes(material)
  )

  if (!materialItem) {
    bot.chat(`Need ${material} blocks to build!`)
    return
  }

  const totalBlocks = template.blocks.length - (template.doorway?.length || 0)
  bot.chat(`Placing ${totalBlocks} blocks...`)

  // Starting position (current bot position)
  const startPos = bot.entity.position.floored()
  let placed = 0
  let failed = 0

  // Sort blocks by height (build from bottom to top)
  const sortedBlocks = [...template.blocks].sort((a, b) => a[1] - b[1])

  for (const [dx, dy, dz] of sortedBlocks) {
    // Skip doorway blocks
    if (template.doorway?.some(([x, y, z]) => x === dx && y === dy && z === dz)) {
      continue
    }

    const x = startPos.x + dx
    const y = startPos.y + dy
    const z = startPos.z + dz

    // Move closer to build position
    const goal = new goals.GoalNear(x, y, z, 4)
    bot.pathfinder.setGoal(goal)

    // Wait for position
    await new Promise(resolve => setTimeout(resolve, 500))

    // Place block
    const result = await placeBlock(x, y, z, material)

    if (result.success) {
      placed++
      if (placed % 10 === 0) {
        bot.chat(`Progress: ${placed}/${totalBlocks}`)
      }
    } else {
      failed++
      console.log(`[BUILD] Failed at (${dx},${dy},${dz}): ${result.error}`)
    }

    // Check if we ran out of materials
    const hasBlocks = bot.inventory.items().some(item => item.name.includes(material))
    if (!hasBlocks) {
      bot.chat(`Ran out of ${material}! Placed ${placed} blocks.`)
      return
    }
  }

  bot.pathfinder.setGoal(null)
  bot.chat(`${structureName} complete! Placed ${placed} blocks.`)
  console.log(`[BUILD] Completed. Success: ${placed}, Failed: ${failed}`)
}

// Monitor health changes
bot.on('health', () => {
  if (bot.health < 10) {
    console.log(`⚠️  Low health: ${bot.health}`)
  }
})

// Monitor food changes
bot.on('food', () => {
  if (bot.food < 6) {
    console.log(`⚠️  Low food: ${bot.food}`)
  }
})

bot.on('chat', async (username, message) => {
  console.log(`[CHAT] ${username}: ${message}`)

  if (username === bot.username) return

  const msg = message.toLowerCase()

  // AI command - natural language control
  if (msg.startsWith('ai ')) {
    const query = message.substring(3).trim() // Remove "ai " prefix
    bot.chat('Thinking...')

    try {
      // Simple preprocessing for common patterns
      let action = null

      // Check for direct mining commands
      const mineMatch = query.match(/mine\s+(\d+\s+)?(\w+)/i)
      if (mineMatch) {
        const blockType = mineMatch[2]
        action = { action: 'mine', blockType: blockType }
      }

      // Check for building commands
      const buildMatch = query.match(/build\s+(a\s+)?(\w+)\s*(\w+)?/i)
      if (buildMatch) {
        const structure = buildMatch[2]
        const material = buildMatch[3] || 'planks'
        action = { action: 'build', structure: structure, material: material }
      }

      // If no direct match, ask AI
      if (!action) {
        action = await askAI(query)
      }

      console.log('[AI] Selected action:', action)
      await executeAction(action, username)
    } catch (error) {
      bot.chat('AI processing failed')
      console.error('[AI ERROR]', error)
    }
    return
  }

  // Follow command - smart pathfinding to follow player
  if (msg === 'follow') {
    const target = bot.players[username]?.entity
    if (!target) {
      bot.chat('I cannot see you')
      return
    }

    bot.chat('Following you!')
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
  }

  // Stop command - stop all pathfinding
  if (msg === 'stop') {
    bot.pathfinder.setGoal(null)
    bot.chat('Stopped')
  }

  // State command - display current bot state
  if (msg === 'state' || msg === 'status') {
    const state = getState()
    bot.chat(`Pos: (${state.position.x}, ${state.position.y}, ${state.position.z})`)
    bot.chat(`Health: ${state.health} | Food: ${state.food}`)
    bot.chat(`Inventory: ${state.inventory.length} items`)
    console.log('[STATE]', JSON.stringify(state, null, 2))
  }

  // Keep the old come command for backwards compatibility
  if (msg === 'come') {
    bot.chat('Coming!')
    bot.setControlState('forward', true)

    setTimeout(() => {
      bot.setControlState('forward', false)
    }, 3000)
  }

  // Mine command - find and mine nearby blocks
  if (msg.startsWith('mine')) {
    const args = msg.split(' ')
    const blockType = args[1] || 'log' // default to logs

    bot.chat(`Looking for ${blockType}...`)

    const block = bot.findBlock({
      matching: (block) => block.name.includes(blockType),
      maxDistance: 32
    })

    if (!block) {
      bot.chat(`No ${blockType} blocks found nearby`)
      return
    }

    bot.chat(`Found ${block.name} at ${block.position}. Mining...`)

    // Use pathfinder to get close to the block, then mine it
    const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z)
    bot.pathfinder.setGoal(goal)

    bot.once('goal_reached', async () => {
      try {
        await bot.dig(block)
        bot.chat(`Mined ${block.name}!`)
      } catch (err) {
        bot.chat(`Failed to mine: ${err.message}`)
        console.error('[MINE ERROR]', err)
      }
    })
  }

  // Build command - construct structures
  if (msg.startsWith('build')) {
    const args = msg.split(' ')
    const structure = args[1]
    const material = args[2] || 'planks'

    if (!structure) {
      bot.chat('Usage: build [structure] [material]')
      bot.chat(`Available: ${Object.keys(buildingTemplates).join(', ')}`)
      return
    }

    await buildStructure(structure, material)
  }

  // Structures command - list available structures
  if (msg === 'structures') {
    bot.chat('Available structures:')
    Object.entries(buildingTemplates).forEach(([name, template]) => {
      bot.chat(`- ${name}: ${template.description}`)
    })
  }
})
