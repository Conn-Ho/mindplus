'use strict'

const { ok, fail } = require('../db')
const config = require('../config')
const { redeemGovCode, clawbackGovCredits } = require('../services/billing')

module.exports = async function redeemRoutes(fastify) {
  const auth = { preHandler: [fastify.authenticate] }

  // 用户用政府核销码兑换额度:激活(核销服务)→ 充值钱包(MindUser)
  fastify.post('/gov-code', auth, async (req, reply) => {
    const code = String(req.body?.code || '').trim()
    if (!code) return reply.code(400).send(fail('请输入核销码', 400))
    try {
      const data = await redeemGovCode({ req, code })
      return ok(data, '兑换成功')
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500)
      return reply.code(statusCode).send({ code: statusCode, data: null, message: String(error?.message || '兑换失败') })
    }
  })

  // 核销服务追扣回调(内部密钥鉴权)
  fastify.post('/clawback', async (req, reply) => {
    const key = String(req.headers['x-api-key'] || '')
    if (!key || key !== config.hexiao.internalKey) {
      return reply.code(401).send(fail('unauthorized', 401))
    }
    const userRef = String(req.body?.userRef || '').trim()
    const amount = Number(req.body?.amount)
    if (!userRef || !Number.isFinite(amount)) {
      return reply.code(400).send(fail('bad_payload', 400))
    }
    try {
      const spent = await clawbackGovCredits({ userId: userRef, amount, govCode: req.body?.govCode })
      return ok({ spent }, '已追扣')
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500)
      return reply.code(statusCode).send({ code: statusCode, data: null, message: String(error?.message || '追扣失败') })
    }
  })
}
