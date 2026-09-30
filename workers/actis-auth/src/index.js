const FIREBASE_AUDIENCE =

  "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit"










function base64UrlEncodeBytes(

  bytes

) {



  let binary = ""



  for (

    const byte

    of bytes

  ) {



    binary +=

      String.fromCharCode(

        byte

      )



  }



  return btoa(

    binary

  )

    .replace(

      /\+/g,

      "-"

    )

    .replace(

      /\//g,

      "_"

    )

    .replace(

      /=+$/g,

      ""

    )



}





function base64UrlEncodeString(

  value

) {



  return base64UrlEncodeBytes(

    new TextEncoder().encode(

      value

    )

  )



}










function pemToArrayBuffer(

  pem

) {



  let value =

    String(

      pem || ""

    ).trim()





  if (!value) {



    throw new Error(

      "FIREBASE_PRIVATE_KEYが空です"

    )



  }








  value =

    value.replace(

      /\\n/g,

      "\n"

    )








  if (

    value.startsWith('"') &&

    value.endsWith('"')

  ) {



    value =

      value.slice(

        1,

        -1

      )



  }








  const match =

    value.match(

      /-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/

    )





  if (!match) {



    throw new Error(

      "FIREBASE_PRIVATE_KEYの形式が不正です"

    )



  }





  let base64 =

    match[1]





  base64 =

    base64.replace(

      /\s/g,

      ""

    )





  if (!base64) {



    throw new Error(

      "FIREBASE_PRIVATE_KEYの本文が空です"

    )



  }








  const remainder =

    base64.length % 4





  if (

    remainder !== 0

  ) {



    base64 +=

      "=".repeat(

        4 - remainder

      )



  }





  let binary



  try {



    binary =

      atob(

        base64

      )



  }



  catch (error) {



    throw new Error(

      `FIREBASE_PRIVATE_KEYのBase64デコードに失敗しました: ${error.message}`

    )



  }





  const bytes =

    new Uint8Array(

      binary.length

    )





  for (

    let i = 0;

    i < binary.length;

    i++

  ) {



    bytes[i] =

      binary.charCodeAt(

        i

      )



  }





  return bytes.buffer



}










async function getFirebaseUserFromIdToken(idToken, env) {
  const apiKey = String(env.FIREBASE_API_KEY || "").trim()
  if (!apiKey) throw new Error("FIREBASE_API_KEY が設定されていません")
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(data.users) || !data.users[0]?.localId) {
    throw new Error("Firebase ID tokenを確認できませんでした")
  }
  return data.users[0]
}

function jsonResponse(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": String(env.ACTIS_ORIGIN || "*"),
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    }
  })
}

async function startProviderLink(request, env, provider) {
  const authorization = request.headers.get("Authorization") || ""
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) return jsonResponse({ error: "認証情報がありません" }, 401, env)

  let firebaseUser
  try {
    firebaseUser = await getFirebaseUserFromIdToken(match[1], env)
  } catch (error) {
    return jsonResponse({ error: error.message }, 401, env)
  }

  const accountId = String(firebaseUser.localId || "").trim()
  if (!accountId) return jsonResponse({ error: "ACTISアカウントIDを取得できませんでした" }, 401, env)

  const state = crypto.randomUUID()
  await env.AUTH_KV.put(
    `oauth-state:link:${provider}:${state}`,
    JSON.stringify({ accountId, provider }),
    { expirationTtl: 600 }
  )

  const params = new URLSearchParams()
  let target

  if (provider === "discord") {
    const clientId = String(env.DISCORD_CLIENT_ID || "").trim()
    const redirectUri = String(env.DISCORD_REDIRECT_URI || "").trim()
    if (!clientId || !redirectUri) return jsonResponse({ error: "Discord OAuth設定が不足しています" }, 500, env)
    params.set("client_id", clientId)
    params.set("response_type", "code")
    params.set("redirect_uri", redirectUri)
    params.set("scope", "identify email")
    params.set("state", state)
    target = "https://discord.com/oauth2/authorize?" + params.toString()
  } else if (provider === "google") {
    const clientId = String(env.GOOGLE_CLIENT_ID || "").trim()
    const redirectUri = String(env.GOOGLE_REDIRECT_URI || "").trim()
    if (!clientId || !redirectUri) return jsonResponse({ error: "Google OAuth設定が不足しています" }, 500, env)
    params.set("client_id", clientId)
    params.set("redirect_uri", redirectUri)
    params.set("response_type", "code")
    params.set("scope", "openid email profile")
    params.set("state", state)
    target = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString()
  } else {
    return jsonResponse({ error: "未対応のプロバイダです" }, 400, env)
  }

  return jsonResponse({ url: target }, 200, env)
}

async function getLinkState(env, provider, state) {
  if (!state) return null
  const key = `oauth-state:link:${provider}:${state}`
  const value = await env.AUTH_KV.get(key)
  if (!value) return null
  await env.AUTH_KV.delete(key)
  try { return JSON.parse(value) } catch { return null }
}

function linkSuccessRedirect(env, provider, user, email) {
  const params = new URLSearchParams()
  params.set("link", "success")
  params.set("provider", provider)
  if (provider === "discord") {
    params.set("discord_id", user.id || "")
    params.set("username", user.username || "")
    params.set("global_name", user.global_name || "")
    params.set("avatar", user.avatar || "")
  } else {
    params.set("google_id", user.sub || "")
    params.set("username", user.name || "")
    params.set("global_name", user.name || "")
    params.set("avatar", user.picture || "")
  }
  if (email) params.set("email", email)
  return Response.redirect(`${env.ACTIS_ORIGIN}/account?${params.toString()}`, 302)
}

function linkErrorRedirect(env, message) {
  return Response.redirect(
    `${env.ACTIS_ORIGIN}/account?link=error&message=${encodeURIComponent(message)}`,
    302
  )
}

async function createFirebaseCustomToken(

  uid,

  env

) {



  const clientEmail =

    String(

      env.FIREBASE_CLIENT_EMAIL ||

      ""

    ).trim()





  const privateKey =

    String(

      env.FIREBASE_PRIVATE_KEY ||

      ""

    ).trim()





  if (!clientEmail) {



    throw new Error(

      "FIREBASE_CLIENT_EMAIL が設定されていません"

    )



  }





  if (!privateKey) {



    throw new Error(

      "FIREBASE_PRIVATE_KEY が設定されていません"

    )



  }





  const now =

    Math.floor(

      Date.now() / 1000

    )








  const header = {



    alg:

      "RS256",



    typ:

      "JWT"



  }








  const payload = {



    iss:

      clientEmail,



    sub:

      clientEmail,



    aud:

      FIREBASE_AUDIENCE,



    iat:

      now,



    exp:

      now + 3600,



    uid:

      String(uid)



  }





  const encodedHeader =

    base64UrlEncodeString(

      JSON.stringify(

        header

      )

    )





  const encodedPayload =

    base64UrlEncodeString(

      JSON.stringify(

        payload

      )

    )





  const unsignedToken =

    `${encodedHeader}.${encodedPayload}`








  const key =

    await crypto.subtle.importKey(



      "pkcs8",



      pemToArrayBuffer(

        privateKey

      ),



      {



        name:

          "RSASSA-PKCS1-v1_5",



        hash:

          "SHA-256"



      },



      false,



      [

        "sign"

      ]



    )








  const signature =

    await crypto.subtle.sign(



      "RSASSA-PKCS1-v1_5",



      key,



      new TextEncoder().encode(

        unsignedToken

      )



    )





  const encodedSignature =

    base64UrlEncodeBytes(

      new Uint8Array(

        signature

      )

    )





  return (

    `${unsignedToken}.${encodedSignature}`

  )



}










function createActisAccountId() {



  return (



    "ACTIS_" +



    crypto

      .randomUUID()

      .replace(

        /-/g,

        ""

      )

      .slice(

        0,

        20

      )



  )



}










async function findAccountByIdentity(

  env,

  provider,

  identity

) {



  const key =

    `identity:${provider}:${identity}`





  return (

    await env.AUTH_KV.get(

      key

    )

  )



}










async function saveIdentity(

  env,

  provider,

  identity,

  accountId

) {



  await env.AUTH_KV.put(



    `identity:${provider}:${identity}`,



    accountId



  )



}










async function getOrCreateAccount(

  env,

  {

    provider,

    identity,

    email

  }

) {






  let accountId =

    await findAccountByIdentity(

      env,

      provider,

      identity

    )








  if (!accountId) {






    accountId =

      createActisAccountId()



  }








  await saveIdentity(

    env,

    provider,

    identity,

    accountId

  )








  if (email) {



    await env.AUTH_KV.put(



      `account-email:${provider}:${identity}`,



      String(

        email

      )

        .trim()

        .toLowerCase()



    )



  }





  return accountId



}










async function discordLogin(

  env

) {



  const clientId =

    String(

      env.DISCORD_CLIENT_ID ||

      ""

    ).trim()





  const redirectUri =

    String(

      env.DISCORD_REDIRECT_URI ||

      ""

    ).trim()





  if (!clientId) {



    return new Response(

      "DISCORD_CLIENT_ID が未設定です",

      {

        status: 500

      }

    )



  }





  if (!redirectUri) {



    return new Response(

      "DISCORD_REDIRECT_URI が未設定です",

      {

        status: 500

      }

    )



  }





  const params =

    new URLSearchParams()





  params.set(

    "client_id",

    clientId

  )





  params.set(

    "response_type",

    "code"

  )





  params.set(

    "redirect_uri",

    redirectUri

  )





  params.set(

    "scope",

    "identify email"

  )





  return Response.redirect(



    "https://discord.com/oauth2/authorize?" +

      params.toString(),



    302



  )



}










async function googleLogin(

  env

) {



  const clientId =

    String(

      env.GOOGLE_CLIENT_ID ||

      ""

    ).trim()





  const redirectUri =

    String(

      env.GOOGLE_REDIRECT_URI ||

      ""

    ).trim()





  if (!clientId) {



    return new Response(

      "GOOGLE_CLIENT_ID が未設定です",

      {

        status: 500

      }

    )



  }





  if (!redirectUri) {



    return new Response(

      "GOOGLE_REDIRECT_URI が未設定です",

      {

        status: 500

      }

    )



  }








  const state =

    crypto.randomUUID()





  await env.AUTH_KV.put(



    `oauth-state:google:${state}`,



    "1",



    {

      expirationTtl:

        600

    }



  )





  const params =

    new URLSearchParams()





  params.set(

    "client_id",

    clientId

  )





  params.set(

    "redirect_uri",

    redirectUri

  )





  params.set(

    "response_type",

    "code"

  )





  params.set(

    "scope",

    "openid email profile"

  )





  params.set(

    "state",

    state

  )





  return Response.redirect(



    "https://accounts.google.com/o/oauth2/v2/auth?" +

      params.toString(),



    302



  )



}










async function discordCallback(

  request,

  env

) {



  const url =

    new URL(

      request.url

    )








  const error =

    url.searchParams.get(

      "error"

    )





  if (error) {



    return Response.redirect(



      `${env.ACTIS_ORIGIN}/login#error=Discordログインがキャンセルされました`,



      302



    )



  }








  const code =

    url.searchParams.get(

      "code"

    )





  if (!code) {



    return Response.redirect(



      `${env.ACTIS_ORIGIN}/login#error=Discord認証コードを取得できませんでした`,



      302



    )



  }





  const clientId =

    String(

      env.DISCORD_CLIENT_ID ||

      ""

    ).trim()





  const clientSecret =

    String(

      env.DISCORD_CLIENT_SECRET ||

      ""

    ).trim()





  const redirectUri =

    String(

      env.DISCORD_REDIRECT_URI ||

      ""

    ).trim()








  const body =

    new URLSearchParams()





  body.set(

    "client_id",

    clientId

  )





  body.set(

    "client_secret",

    clientSecret

  )





  body.set(

    "grant_type",

    "authorization_code"

  )





  body.set(

    "code",

    code

  )





  body.set(

    "redirect_uri",

    redirectUri

  )





  const tokenResponse =

    await fetch(



      "https://discord.com/api/v10/oauth2/token",



      {



        method:

          "POST",



        headers: {



          "Content-Type":

            "application/x-www-form-urlencoded"



        },



        body



      }



    )





  const tokenText =

    await tokenResponse.text()





  if (

    !tokenResponse.ok

  ) {



    console.error(

      "Discord token error:",

      tokenText

    )





    return new Response(



      `Discord OAuth token error\n\n${tokenText}`,



      {



        status:

          500,



        headers: {



          "Content-Type":

            "text/plain; charset=UTF-8"



        }



      }



    )



  }





  let token



  try {



    token =

      JSON.parse(

        tokenText

      )



  }



  catch {



    return new Response(

      "Discord token responseを解析できませんでした。",

      {

        status: 500

      }

    )



  }








  const userResponse =

    await fetch(



      "https://discord.com/api/v10/users/@me",



      {



        headers: {



          Authorization:

            `Bearer ${token.access_token}`



        }



      }



    )





  const userText =

    await userResponse.text()





  if (

    !userResponse.ok

  ) {



    console.error(

      "Discord user error:",

      userText

    )





    return new Response(



      `Discord user error\n\n${userText}`,



      {



        status:

          500,



        headers: {



          "Content-Type":

            "text/plain; charset=UTF-8"



        }



      }



    )



  }





  let user



  try {



    user =

      JSON.parse(

        userText

      )



  }



  catch {



    return new Response(

      "Discordユーザー情報を解析できませんでした。",

      {

        status: 500

      }

    )



  }





  if (!user.id) {



    return new Response(

      "Discord User IDを取得できませんでした。",

      {

        status: 500

      }

    )



  }








  const email =

    user.email &&

    user.verified

      ? user.email

      : ""








  if (linkState) {
    const existingAccountId = await findAccountByIdentity(env, "discord", user.id)
    if (existingAccountId && existingAccountId !== linkState.accountId) {
      return linkErrorRedirect(env, "このDiscordアカウントは別のACTISアカウントに連携されています")
    }
    await saveIdentity(env, "discord", user.id, linkState.accountId)
    if (email) {
      await env.AUTH_KV.put(`account-email:discord:${user.id}`, String(email).trim().toLowerCase())
    }
    return linkSuccessRedirect(env, "discord", user, email)
  }

  const accountId =

    await getOrCreateAccount(



      env,



      {



        provider:

          "discord",



        identity:

          user.id,



        email



      }



    )








  const customToken =

    await createFirebaseCustomToken(



      accountId,



      env



    )








  const params =

    new URLSearchParams()





  params.set(

    "token",

    customToken

  )





  params.set(

    "provider",

    "discord"

  )








  params.set(

    "discord_id",

    user.id

  )





  params.set(

    "username",

    user.username || ""

  )





  params.set(

    "global_name",

    user.global_name || ""

  )





  params.set(

    "avatar",

    user.avatar || ""

  )





  if (email) {



    params.set(

      "email",

      email

    )



  }





  return Response.redirect(



    `${env.ACTIS_ORIGIN}/login#${params.toString()}`,



    302



  )



}










async function googleCallback(

  request,

  env

) {



  const url =

    new URL(

      request.url

    )





  const code =

    url.searchParams.get(

      "code"

    )





  const state =

    url.searchParams.get(

      "state"

    )





  if (

    !code ||

    !state

  ) {



    return Response.redirect(



      `${env.ACTIS_ORIGIN}/login#error=Google認証に失敗しました`,



      302



    )



  }








  const linkState = await getLinkState(env, "google", state)

  if (!linkState) {
    const stateKey = `oauth-state:google:${state}`
    const validState = await env.AUTH_KV.get(stateKey)

    if (!validState) {
      return Response.redirect(
        `${env.ACTIS_ORIGIN}/login#error=Google認証状態が無効です`,
        302
      )
    }

    await env.AUTH_KV.delete(stateKey)
  }

  const clientId =

    String(

      env.GOOGLE_CLIENT_ID ||

      ""

    ).trim()





  const clientSecret =

    String(

      env.GOOGLE_CLIENT_SECRET ||

      ""

    ).trim()





  const redirectUri =

    String(

      env.GOOGLE_REDIRECT_URI ||

      ""

    ).trim()





  const body =

    new URLSearchParams()





  body.set(

    "client_id",

    clientId

  )





  body.set(

    "client_secret",

    clientSecret

  )





  body.set(

    "code",

    code

  )





  body.set(

    "grant_type",

    "authorization_code"

  )





  body.set(

    "redirect_uri",

    redirectUri

  )





  const tokenResponse =

    await fetch(



      "https://oauth2.googleapis.com/token",



      {



        method:

          "POST",



        headers: {



          "Content-Type":

            "application/x-www-form-urlencoded"



        },



        body



      }



    )





  const tokenText =

    await tokenResponse.text()





  if (

    !tokenResponse.ok

  ) {



    console.error(

      "Google token error:",

      tokenText

    )





    return new Response(



      `Google OAuth token error\n\n${tokenText}`,



      {



        status:

          500,



        headers: {



          "Content-Type":

            "text/plain; charset=UTF-8"



        }



      }



    )



  }





  let token



  try {



    token =

      JSON.parse(

        tokenText

      )



  }



  catch {



    return new Response(

      "Google token responseを解析できませんでした。",

      {

        status: 500

      }

    )



  }








  const userResponse =

    await fetch(



      "https://openidconnect.googleapis.com/v1/userinfo",



      {



        headers: {



          Authorization:

            `Bearer ${token.access_token}`



        }



      }



    )





  const userText =

    await userResponse.text()





  if (

    !userResponse.ok

  ) {



    console.error(

      "Google user error:",

      userText

    )





    return new Response(



      `Google user error\n\n${userText}`,



      {



        status:

          500,



        headers: {



          "Content-Type":

            "text/plain; charset=UTF-8"



        }



      }



    )



  }





  let user



  try {



    user =

      JSON.parse(

        userText

      )



  }



  catch {



    return new Response(

      "Googleユーザー情報を解析できませんでした。",

      {

        status: 500

      }

    )



  }





  if (

    !user.sub

  ) {



    return new Response(

      "Google User IDを取得できませんでした。",

      {

        status: 500

      }

    )



  }





  if (

    !user.email ||

    user.email_verified !== true

  ) {



    return Response.redirect(



      `${env.ACTIS_ORIGIN}/login#error=Googleの確認済みメールアドレスを取得できませんでした`,



      302



    )



  }








  if (linkState) {
    const existingAccountId = await findAccountByIdentity(env, "google", user.sub)
    if (existingAccountId && existingAccountId !== linkState.accountId) {
      return linkErrorRedirect(env, "このGoogleアカウントは別のACTISアカウントに連携されています")
    }
    await saveIdentity(env, "google", user.sub, linkState.accountId)
    await env.AUTH_KV.put(
      `account-email:google:${user.sub}`,
      String(user.email).trim().toLowerCase()
    )
    return linkSuccessRedirect(env, "google", user, user.email)
  }

  const accountId =

    await getOrCreateAccount(



      env,



      {



        provider:

          "google",



        identity:

          user.sub,



        email:

          user.email



      }



    )








  const customToken =

    await createFirebaseCustomToken(



      accountId,



      env



    )








  const params =

    new URLSearchParams()





  params.set(

    "token",

    customToken

  )





  params.set(

    "provider",

    "google"

  )





  params.set(

    "google_id",

    user.sub

  )





  params.set(

    "username",

    user.name || ""

  )





  params.set(

    "global_name",

    user.name || ""

  )





  params.set(

    "avatar",

    user.picture || ""

  )





  params.set(

    "email",

    user.email

  )





  return Response.redirect(



    `${env.ACTIS_ORIGIN}/login#${params.toString()}`,



    302



  )



}










export default {



  async fetch(

    request,

    env

  ) {



    const url =

      new URL(

        request.url

      )








    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": String(env.ACTIS_ORIGIN || "*"),
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, OPTIONS"
        }
      })
    }

    if (

      url.pathname === "/" &&

      request.method === "GET"

    ) {



      return new Response(

        "ACTIS Auth Worker OK",

        {



          headers: {



            "Content-Type":

              "text/plain; charset=UTF-8"



          }



        }



      )



    }








    if (

      url.pathname ===

        "/auth/discord" &&

      request.method === "GET"

    ) {



      return discordLogin(

        env

      )



    }





    if (

      url.pathname ===

        "/auth/discord/callback" &&

      request.method === "GET"

    ) {



      return discordCallback(

        request,

        env

      )



    }








    if (

      url.pathname ===

        "/auth/google" &&

      request.method === "GET"

    ) {



      return googleLogin(

        env

      )



    }





    if (

      url.pathname ===

        "/auth/google/callback" &&

      request.method === "GET"

    ) {



      return googleCallback(

        request,

        env

      )



    }








    if (url.pathname === "/auth/link/discord" && request.method === "GET") {
      return startProviderLink(request, env, "discord")
    }

    if (url.pathname === "/auth/link/google" && request.method === "GET") {
      return startProviderLink(request, env, "google")
    }

    return new Response(

      "Not Found",

      {



        status:

          404



      }



    )



  }



}

