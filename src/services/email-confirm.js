import { supabase, insertHouseholdMembers, insertMembership, getCurrentSeason } from '/src/services/db.js'

function showState(id) {
  ;['loadingState', 'successState', 'errorState'].forEach(s => {
    const el = document.getElementById(s)
    el.classList.add('hidden')
    el.classList.remove('flex')
  })
  const el = document.getElementById(id)
  el.classList.remove('hidden')
  if (id !== 'loadingState') el.classList.add('flex')
}

async function handleConfirmation() {
  // check for error in URL hash first
  const hash = window.location.hash
  if (hash.includes('error=')) {
    const params = new URLSearchParams(hash.replace('#', ''))
    console.error('Auth error:', params.get('error_description'))
    showState('errorState')
    return
  }

  try {
    // give Supabase a moment to process the token
    await new Promise(resolve => setTimeout(resolve, 1000))

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      showState('errorState')
      return
    }

    const season = await getCurrentSeason()

    // check if membership already exists — prevents duplicate on double click
    const { data: existing } = await supabase
      .from('memberships')
      .select('id')
      .eq('profile_id', session.user.id)
      .eq('season_id', season.id)
      .maybeSingle()

    if (!existing) {
      //const pendingData = JSON.parse(localStorage.getItem('pendingSignup') || '{}')
      const pendingData = session.user.user_metadata?.householdMembers || '[]'
      console.log(pendingData)

      if (pendingData.length > 0) {
        await insertHouseholdMembers(session.user.id, pendingData)
      }

      await insertMembership(session.user.id, season.id)
      //localStorage.removeItem('pendingSignup')
    }

    showState('successState')

  } catch (err) {
    console.error('Confirmation error:', err)
    showState('errorState')
  }
}

handleConfirmation()