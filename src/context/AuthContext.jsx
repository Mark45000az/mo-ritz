import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { auth, googleProvider, firestore } from '../lib/firebase'
import { ADMIN_EMAILS } from '../config/communityConfig'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeDoc = null

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user)
        const userRef = doc(firestore, 'users', user.uid)

        try {
          const userSnap = await getDoc(userRef)
          const isUserAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase())

          if (!userSnap.exists()) {
            const initialData = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Member',
              photoURL: user.photoURL || (isUserAdmin ? '/profile.jpg' : '/NewUserProfile.png'),
              role: isUserAdmin ? 'admin' : 'member',
              isBanned: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
            await setDoc(userRef, initialData)
            setUserProfile(initialData)
          } else {
            // If email is in ADMIN_EMAILS but role is not admin, upgrade role
            const existingData = userSnap.data()
            if (isUserAdmin && existingData.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin' })
            }
            setUserProfile(existingData)
          }

          // Real-time listener for user profile changes (like ban, role, photo)
          unsubscribeDoc = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              setUserProfile(snapshot.data())
            }
          })
        } catch (err) {
          console.error('[AuthContext] Error syncing user document:', err)
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Member',
            photoURL: user.photoURL || (ADMIN_EMAILS.includes(user.email?.toLowerCase()) ? '/profile.jpg' : '/NewUserProfile.png'),
            role: ADMIN_EMAILS.includes(user.email?.toLowerCase()) ? 'admin' : 'member',
            isBanned: false,
          })
        }
      } else {
        if (unsubscribeDoc) unsubscribeDoc()
        setCurrentUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeDoc) unsubscribeDoc()
    }
  }, [])

  // Google Login
  const loginWithGoogle = async () => {
    return signInWithPopup(auth, googleProvider)
  }

  // Email Signup
  const signupWithEmail = async (email, password, displayName) => {
    const res = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(res.user, { displayName })
    }
    const isUserAdmin = ADMIN_EMAILS.includes(email?.toLowerCase())
    const userRef = doc(firestore, 'users', res.user.uid)
    const initialData = {
      uid: res.user.uid,
      email: res.user.email,
      displayName: displayName || email.split('@')[0],
      photoURL: isUserAdmin ? '/profile.jpg' : '/NewUserProfile.png',
      role: isUserAdmin ? 'admin' : 'member',
      isBanned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(userRef, initialData)
    return res.user
  }

  // Email Login
  const loginWithEmail = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

  // Logout
  const logout = async () => {
    return signOut(auth)
  }

  // Update Profile
  const updateUserProfile = async (profileData = {}) => {
    if (!auth.currentUser) return

    const {
      displayName,
      photoURL,
      bio,
      hobbyTag,
      avatarFrame,
      coverGradient,
      coverImage,
      statusMode,
      nametagStyle,
      nametagBadge,
    } = profileData

    const updates = {}
    if (displayName !== undefined) updates.displayName = displayName
    if (photoURL !== undefined) updates.photoURL = photoURL
    if (bio !== undefined) updates.bio = bio
    if (hobbyTag !== undefined) updates.hobbyTag = hobbyTag
    if (avatarFrame !== undefined) updates.avatarFrame = avatarFrame
    if (coverGradient !== undefined) updates.coverGradient = coverGradient
    if (coverImage !== undefined) updates.coverImage = coverImage
    if (statusMode !== undefined) updates.statusMode = statusMode
    if (nametagStyle !== undefined) updates.nametagStyle = nametagStyle
    if (nametagBadge !== undefined) updates.nametagBadge = nametagBadge

    // Update in Firebase Auth (Firebase Auth only accepts URLs < 2048 chars, not data URLs)
    const authUpdates = {}
    if (displayName !== undefined) authUpdates.displayName = displayName
    if (photoURL && !photoURL.startsWith('data:') && photoURL.length < 2000) {
      authUpdates.photoURL = photoURL
    }

    if (Object.keys(authUpdates).length > 0) {
      try {
        await updateProfile(auth.currentUser, authUpdates)
      } catch (authErr) {
        console.warn('[AuthContext] Firebase Auth profile update warning:', authErr.message)
      }
    }

    // Update in Firestore (Firestore stores up to 1MB, handles image data URLs perfectly)
    const userRef = doc(firestore, 'users', auth.currentUser.uid)
    await setDoc(
      userRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )

    setUserProfile((prev) => ({ ...prev, ...updates }))
  }

  const isAdmin = Boolean(
    userProfile?.role === 'admin' ||
    ADMIN_EMAILS.includes(currentUser?.email?.toLowerCase())
  )

  const isBanned = Boolean(userProfile?.isBanned)

  const value = {
    currentUser,
    userProfile,
    loading,
    isAdmin,
    isBanned,
    loginWithGoogle,
    signupWithEmail,
    loginWithEmail,
    logout,
    updateUserProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

