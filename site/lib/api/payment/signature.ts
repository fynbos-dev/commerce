const SIGNATURE_HOST = 'http://localhost:3040'
const PEER_SIGNATURE_HOST = 'http://localhost:3041'

export const signGrantRequest = async (request: Request) => {
  const requestBody = await request.clone().json()
  const client = new URL(requestBody.client)

  const jwkUrl = `http://localhost:${client.host === 'backend' ? '3' : '4'}000${
    client.pathname
  }/jwks.json`

  const signatureUrl =
    client.host === 'backend' ? SIGNATURE_HOST : PEER_SIGNATURE_HOST

  const requestHeaders = Object.fromEntries(request.headers)

  const keys = await fetch(jwkUrl, {
    method: 'GET',
    headers: {
      Host: client.host,
    },
  })
    .catch((err) => {
      throw new Error("There was an error fetching the client's JWK " + err)
    })
    .then(async (res) => await res.json())

  const keyId = keys.keys[0].kid

  const headers = await fetch(signatureUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      keyId: keyId,
      request: {
        url: request.url,
        method: request.method,
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      },
    }),
  })
    .catch((err) => {
      throw new Error('There was an error fetching the signature headers', err)
    })
    .then(async (res) => await res.json())

  for (let [key, value] of Object.entries(headers)) {
    request.headers.append(key, value)
  }

  const requestSigner = preRequestSignatures(signatureUrl, keyId)

  return {
    signedGrantRequest: request,
    requestSigner,
    signatureUrl,
    keyId,
  }
}

export const preRequestSignatures =
  (signatureUrl: string, keyId: string) => async (request: Request) => {
    const requestUrl = request.url.replace(/localhost:([3,4])000/g, (_, key) =>
      key === '3' ? 'backend' : 'peer-backend'
    )
    const requestHeaders = Object.fromEntries(request.headers)
    const requestBody = JSON.stringify(await request.clone().json())

    const headers = await fetch(signatureUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        keyId: keyId,
        request: {
          url: requestUrl,
          method: request.method,
          headers: requestHeaders,
          body: requestBody,
        },
      }),
    })
      .catch((err) => {
        throw new Error(
          'There was an error fetching the signature headers ' + err
        )
      })
      .then(async (res) => await res.json())

    for (let [key, value] of Object.entries(headers)) {
      request.headers.append(key, value)
    }

    return request
  }
