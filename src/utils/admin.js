export const ADMIN_UID = "ACTIS_15e1bbda2e5246729263"

export function isAdminUser(user) {
  return Boolean(user?.uid && user.uid === ADMIN_UID)
}
