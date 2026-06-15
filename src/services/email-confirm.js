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
    await new Promise(resolve => setTimeout(resolve, 3000))
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      showState('errorState')
      return
    }

    showState('successState')
    await supabase
      .from('profiles')
      .update({email_confirmed: true})
      .eq('id', session.user.id)

  } catch (err) {
    console.error('Confirmation error:', err)
    showState('errorState')
  }
}

handleConfirmation()