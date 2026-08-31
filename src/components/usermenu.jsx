import {
  useEffect,
  useState
} from "react"

import {
  onAuthStateChanged,
  signOut
} from "firebase/auth"

import {
  ref,
  get
} from "firebase/database"

import {
  useNavigate
} from "react-router-dom"

import {
  auth,
  database
} from "../firebase/config"


function UserMenu() {

  const navigate =
    useNavigate()


  const [
    user,
    setUser
  ] =
    useState(null)


  const [
    profile,
    setProfile
  ] =
    useState(null)


  const [
    open,
    setOpen
  ] =
    useState(false)


  useEffect(() => {

    let mounted = true


    const unsubscribe =
      onAuthStateChanged(
        auth,
        async currentUser => {

          if (!mounted) {
            return
          }


          setUser(
            currentUser
          )


          if (!currentUser) {

            setProfile(null)

            return

          }


          try {

            const snapshot =
              await get(
                ref(
                  database,
                  `users/${currentUser.uid}/profile`
                )
              )


            if (!mounted) {
              return
            }


            if (
              snapshot.exists()
            ) {

              setProfile(
                snapshot.val()
              )

            } else {

              setProfile(null)

            }

          }

          catch (error) {

            console.error(
              "ACTIS profile load error:",
              error
            )

            setProfile(null)

          }

        }
      )


    return () => {

      mounted = false

      unsubscribe()

    }

  }, [])


  /*
   * 未ログイン
   */

  if (!user) {
    return null
  }


  /*
   * ========================================
   * 表示名
   * ========================================
   */

  const displayName =
    profile?.displayName ||
    profile?.discord?.globalName ||
    profile?.discord?.username ||
    profile?.google?.name ||
    profile?.email ||
    "ACTISユーザー"


  /*
   * ========================================
   * プロバイダ
   * ========================================
   */

  const providers =
    Array.isArray(
      profile?.providers
    )
      ? profile.providers
      : []


  /*
   * ========================================
   * アイコン
   * ========================================
   */

  let avatarUrl = ""


  if (
    profile?.discord?.avatar &&
    profile?.discord?.username
  ) {

    /*
     * Discordのavatarは
     * Custom Tokenのプロフィール保存時に
     * 保存されたものを使う。
     */

    /*
     * Discord IDが必要なので
     * Firebase UIDを使用。
     *
     * 新ACTIS UIDの場合Discord IDではないため、
     * 後でdiscord.idを保存する仕様に
     * 変更してもOK。
     */

    if (
      profile?.discord?.id
    ) {

      avatarUrl =
        `https://cdn.discordapp.com/avatars/${profile.discord.id}/${profile.discord.avatar}.png?size=64`

    }

  }


  /*
   * Google
   */

  if (
    !avatarUrl &&
    profile?.google?.avatar
  ) {

    avatarUrl =
      profile.google.avatar

  }


  /*
   * ========================================
   * ログアウト
   * ========================================
   */

  const logout =
    async () => {

      try {

        await signOut(
          auth
        )


        setOpen(
          false
        )


        navigate(
          "/login",
          {
            replace: true
          }
        )

      }

      catch (error) {

        console.error(
          "ACTIS logout error:",
          error
        )

      }

    }


  /*
   * ========================================
   * 表示
   * ========================================
   */

  return (

    <div
      className="user-menu"
    >

      <button
        type="button"
        className="user-menu-button"
        onClick={() =>
          setOpen(
            value =>
              !value
          )
        }
      >

        {avatarUrl ? (

          <img
            src={
              avatarUrl
            }
            alt=""
            className="user-avatar"
          />

        ) : (

          <div
            className="user-avatar-fallback"
          >

            {
              displayName.charAt(0)
            }

          </div>

        )}


        <span
          className="user-name"
        >

          {displayName}

        </span>


        <span>
          ▾
        </span>

      </button>


      {open && (

        <div
          className="user-menu-dropdown"
        >

          <div
            className="user-menu-profile"
          >

            {avatarUrl ? (

              <img
                src={
                  avatarUrl
                }
                alt=""
                className="user-avatar-large"
              />

            ) : (

              <div
                className="user-avatar-large user-avatar-fallback"
              >

                {
                  displayName.charAt(0)
                }

              </div>

            )}


            <div>

              <strong>
                {displayName}
              </strong>


              <small>
                ACTISアカウント
              </small>

            </div>

          </div>


          <div
            className="user-menu-providers"
          >

            {providers.includes(
              "discord"
            ) && (

              <div>
                ✓ Discord
              </div>

            )}


            {providers.includes(
              "google"
            ) && (

              <div>
                ✓ Google
              </div>

            )}

          </div>


          <button
            type="button"
            className="user-account-button"
            onClick={() => {

              setOpen(
                false
              )

              navigate(
                "/account"
              )

            }}
          >

            アカウント設定

          </button>


          <button
            type="button"
            className="logout-button"
            onClick={
              logout
            }
          >

            ログアウト

          </button>

        </div>

      )}

    </div>

  )

}


export default UserMenu