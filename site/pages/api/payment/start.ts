import { signGrantRequest } from '@lib/api/payment/signature'
import { NextApiHandler } from 'next'

const start: NextApiHandler = async (req, res) => {
  const { customerPaymentPointer, amount } = req.body as RequestBody
  const scaledAmount = Number(amount) * 100

  const merchantPaymentPointer = process.env.MERCHANT_PAYMENT_POINTER
  if (!merchantPaymentPointer) {
    res.status(500).json({ error: 'No merchant payment pointer' })
    return
  }

  const customerHost = new URL(customerPaymentPointer.replace('$', 'http://'))
    .host
  const merchantHost = new URL(merchantPaymentPointer.replace('$', 'http://'))
    .host
  const customerPaymentPointerUrl = customerPaymentPointer.replace(
    '$backend',
    'http://localhost:3000'
  )
  const merchantPaymentPointerUrl = merchantPaymentPointer.replace(
    '$peer-backend',
    'http://localhost:4000'
  )

  // get customer and merchant payment pointers
  const customer = await fetch(customerPaymentPointerUrl, {
    method: 'GET',
    headers: {
      Host: customerHost,
    },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Error getting customer payment pointer: ${await res.text()}`
        )
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res
        .status(500)
        .json({ error: 'Error getting customer payment pointer' })
    })

  const merchant = await fetch(merchantPaymentPointerUrl, {
    method: 'GET',
    headers: {
      Host: merchantHost,
    },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Error getting merchant payment pointer: ${await res.text()}`
        )
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res
        .status(500)
        .json({ error: 'Error getting merchant payment pointer' })
    })

  const merchantAuthServerUrl = merchant.authServer.replace(
    'peer-auth:3006',
    'localhost:4006'
  )
  const customerAuthServerUrl = customer.authServer.replace(
    'auth:3006',
    'localhost:3006'
  )

  // create a signed incoming payment grant request
  const incomingPaymentGrantRequest = await signGrantRequest(
    new Request(merchantAuthServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: {
          access: [
            {
              type: 'incoming-payment',
              actions: ['create', 'read', 'list', 'complete'],
            },
          ],
        },
        client: merchantPaymentPointer.replace('$', 'http://'),
      }),
    })
  ).catch((err) => {
    console.error(err)
    throw res
      .status(500)
      .json({ error: 'Error signing incoming grant request' })
  })

  // get the incoming payment grant
  const incomingPaymentGrant = await fetch(
    incomingPaymentGrantRequest.signedGrantRequest
  )
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Error getting incoming payment grant: ${await res.text()}`
        )
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res
        .status(500)
        .json({ error: 'Error getting incoming payment grant' })
    })

  const incomingPaymentRequest = await incomingPaymentGrantRequest
    .requestSigner(
      new Request(merchantPaymentPointerUrl + '/incoming-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: merchantHost,
          Authorization: `GNAP ${incomingPaymentGrant.access_token.value}`,
        },
        body: JSON.stringify({
          incomingAmount: {
            value: scaledAmount.toString(),
            assetCode: 'USD',
            assetScale: 2,
          },
          expiresAt: new Date(
            new Date().getTime() + 24 * 60 * 60 * 1000 // tomorrow
          ).toISOString(),
          description: `Acme Commerce Invoice for ${customerPaymentPointer}`,
        }),
      })
    )
    .catch((err) => {
      console.error(err)
      throw res
        .status(500)
        .json({ error: 'Error signing incoming payment request' })
    })

  const incomingPayment = await fetch(incomingPaymentRequest)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Error getting incoming payment: ${await res.text()}`)
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res.status(500).json({ error: 'Error getting incoming payment' })
    })

  const outgoingPaymentGrantRequest = await signGrantRequest(
    new Request(customerAuthServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: {
          access: [
            {
              type: 'quote',
              actions: ['create', 'read'],
            },
            {
              type: 'outgoing-payment',
              actions: ['create', 'read', 'list'],
              identifier: customerPaymentPointer.replace('$', 'https://'),
              limits: {
                sendAmount: {
                  value: (scaledAmount + scaledAmount * 0.1).toString(), // calculate 10% slippage
                  assetCode: 'USD',
                  assetScale: 2,
                },
                receiveAmount: {
                  value: scaledAmount.toString(),
                  assetCode: 'USD',
                  assetScale: 2,
                },
              },
            },
          ],
        },
        client: customerPaymentPointer.replace('$', 'https://'),
        interact: {
          start: ['spc'],
        },
      }),
    })
  ).catch((err) => {
    console.error(err)
    throw res
      .status(500)
      .json({ error: 'Error signing outgoing grant request' })
  })

  const outgoingPaymentGrantContinue = await fetch(
    outgoingPaymentGrantRequest.signedGrantRequest
  )
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Error getting outgoing payment grant: ${await res.text()}`
        )
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res
        .status(500)
        .json({ error: 'Error getting outgoing payment grant' })
    })

  return res.status(200).json({
    outgoingPaymentGrantContinue,
    incomingPayment,
    keyId: outgoingPaymentGrantRequest.keyId,
    signatureUrl: outgoingPaymentGrantRequest.signatureUrl,
    customerPaymentPointerUrl,
    merchantPaymentPointerUrl,
    merchantHost,
    customerHost,
  })
}

interface RequestBody {
  customerPaymentPointer: string
  amount: string
}

export default start
