import { PublicKeyCredentialWithAssertionJSON } from '@github/webauthn-json'
import { preRequestSignatures } from '@lib/api/payment/signature'
import { NextApiHandler } from 'next'

const finish: NextApiHandler = async (req, res) => {
  const {
    credential,
    keyId,
    signatureUrl,
    incomingPayment,
    outgoingPaymentGrantContinue,
    customerPaymentPointerUrl,
    customerHost,
    merchantHost,
  } = req.body as RequestBody

  const requestSigner = preRequestSignatures(signatureUrl, keyId)

  const outgoingPaymentGrant = await fetch(
    await requestSigner(
      new Request(
        outgoingPaymentGrantContinue.continue.uri.replace('/auth', ''), // continue.uri has an extra auth/ to the auth server url
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `GNAP ${outgoingPaymentGrantContinue.continue.access_token.value}`,
          },
          body: JSON.stringify({
            public_key_cred: credential,
          }),
        }
      )
    ).catch((err) => {
      console.error(err)
      throw res.status(500).json({
        error: 'Error signing outgoing payment continue grant request',
      })
    })
  )
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Error requesting outgoing payment continue grant: ${await res.text()}`
        )
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res
        .status(500)
        .json({ error: 'Error requesting outgoing payment continue grant' })
    })

  const quote = await fetch(
    await requestSigner(
      new Request(customerPaymentPointerUrl + '/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: customerHost,
          Authorization: `GNAP ${outgoingPaymentGrant.access_token.value}`,
        },
        body: JSON.stringify({
          receiver: incomingPayment.id,
        }),
      })
    ).catch((err) => {
      console.error(err)
      throw res.status(500).json({ error: 'Error signing quote request' })
    })
  )
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Error getting quote: ${await res.text()}`)
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res.status(500).json({ error: 'Error requesting quote' })
    })

  const outgoingPayment = await fetch(
    await requestSigner(
      new Request(customerPaymentPointerUrl + '/outgoing-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: customerHost,
          Authorization: `GNAP ${outgoingPaymentGrant.access_token.value}`,
        },
        body: JSON.stringify({
          quoteId: quote.id,
          description: 'Your purchase at Acme Commerce',
        }),
      })
    ).catch((err) => {
      console.error(err)
      throw res
        .status(500)
        .json({ error: 'Error signing outgoing payment request' })
    })
  )
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Error getting outgoing payment: ${await res.text()}`)
      }
      return await res.json()
    })
    .catch((err) => {
      console.error(err)
      throw res.status(500).json({ error: 'Error requesting outgoing payment' })
    })

  return res.status(200).json({ outgoingPayment })
}

export default finish

interface RequestBody {
  credential: PublicKeyCredentialWithAssertionJSON
  keyId: string
  signatureUrl: string
  incomingPayment: any
  outgoingPaymentGrantContinue: any
  customerPaymentPointerUrl: string
  merchantHost: string
  customerHost: string
}
