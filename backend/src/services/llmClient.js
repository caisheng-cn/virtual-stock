const axios = require('axios')

async function callLLM(config, messages, options = {}) {
  const {
    maxTokens = config.max_tokens || 2000,
    temperature = config.temperature || 0.7,
    timeout = 30000
  } = options

  const response = await axios.post(
    config.api_url.replace(/\/+$/, '') + '/chat/completions',
    {
      model: config.model_name || 'gpt-3.5-turbo',
      messages,
      max_tokens: maxTokens,
      temperature: parseFloat(temperature)
    },
    {
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json'
      },
      timeout
    }
  )

  const data = response.data
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || '',
    usage: data.usage || {}
  }
}

async function testConnection(config) {
  try {
    const result = await callLLM(config, [
      { role: 'user', content: '回复"连接成功"四个字' }
    ], { maxTokens: 50 })
    return { success: true, message: result.content }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

module.exports = { callLLM, testConnection }
