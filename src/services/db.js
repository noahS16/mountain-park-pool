import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function signUpUser(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data.user
}

export async function signInUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
}

export async function signOutUser() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user ?? null
}

export async function insertProfile(user, formData) {
    const { error } = await supabase
        .from('profiles')
        .update({
            first_name: formData.firstName,
            last_name: formData.lastName,
            address: formData.address,
            phone: formData.phone,
            emergency_contact_name: formData.ecName,
            emergency_contact_phone: formData.ecPhone,
            payment_preference: formData.payment,
            photo_consent: formData.photoConsent,
        })
        .eq('id', user.id)
    if (error) throw error
}

export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    if (error) throw error
    return data
}

export async function getPaymentMethod(userId){
    const {data, error} = await supabase
        .from('profiles')
        .select('payment_preference')
        .eq('id', userId)
        .single()
    if(error) throw error
    console.log(data)
    return data
}

export async function updateProfile(userId, updates) {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
    if (error) throw error
}

export async function insertHouseholdMembers(profileId, members) {
    // members is an array of { first, last }
    // filter out any empty entries in case user added then removed
    const filtered = members.filter(m => m.first.trim() && m.last.trim())
    if (filtered.length === 0) return

    const rows = filtered.map(m => ({
        profile_id: profileId,
        first_name: m.first,
        last_name: m.last,
    }))

    const { error } = await supabase
        .from('household_members')
        .insert(rows)
    if (error) throw error
}

export async function getHouseholdMembers(profileId) {
    const { data, error } = await supabase
        .from('household_members')
        .select('*')
        .eq('profile_id', profileId)
    if (error) throw error
    return data
}

export async function deleteHouseholdMember(memberId) {
    const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('id', memberId)
    if (error) throw error
}


// ============================================
// MEMBERSHIPS
// ============================================

export async function insertMembership(profileId, seasonId) {
    const { error } = await supabase
        .from('memberships')
        .insert({
            profile_id: profileId,
            season_id: seasonId,
            status: 'pending',
            payment_confirmed: false,
        })
    if (error) throw error
}

export async function getMembership(profileId, seasonId) {
    const { data, error } = await supabase
        .from('memberships')
        .select('*')
        .eq('profile_id', profileId)
        .eq('season_id', seasonId)
        .single()
    if (error) throw error
    return data
}

export async function updateMembershipStatus(profileId, seasonId, status) {
    const { error } = await supabase
        .from('memberships')
        .update({
            status,
            payment_confirmed: status === 'active',
            payment_confirmed_at: status === 'active' ? new Date().toISOString() : null,
        })
        .eq('profile_id', profileId)
        .eq('season_id', seasonId)
    if (error) throw error
}


// ============================================
// SEASONS
// ============================================

export async function getCurrentSeason() {
    const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_current', true)
        .single()
    if (error) throw error
    return data
}


// ============================================
// EVENT BOOKINGS
// ============================================

export async function insertEventBooking(formData, profileId = null) {
  const { error } = await supabase
    .from('event_bookings')
    .insert({
      profile_id: profileId,
      is_member: formData.isMember,
      contact_name: formData.contactName,
      contact_email: formData.contactEmail,
      contact_phone: formData.contactPhone,
      event_date: formData.eventDate,
      event_start_time: formData.eventStartTime,
      event_end_time: formData.eventEndTime,
      headcount: formData.headcount,
      notes: formData.notes,
      status: 'pending',
      deposit_paid: false,
    })
  if (error) throw error
}

export async function getEventBookings(profileId) {
    const { data, error } = await supabase
        .from('event_bookings')
        .select('*')
        .eq('profile_id', profileId)
    if (error) throw error
    return data
}


// ============================================
// ADMIN
// ============================================

export async function getAllMembers() {
    const { data, error } = await supabase
        .from('profiles')
        .select(`
      *,
      memberships (
        status,
        payment_confirmed,
        payment_confirmed_at,
        season_id,
        notes
      ),
      household_members (
        first_name,
        last_name
      ),
      check_ins(
        id
      )
    `)
        // .eq('role', 'member')
        .order('last_name', { ascending: true })
    if (error) throw error
    return data
}

export async function adminUpdateMembership(profileId, seasonId, updates) {
    const { error } = await supabase
        .from('memberships')
        .update(updates)
        .eq('profile_id', profileId)
        .eq('season_id', seasonId)
    if (error) throw error
}

export async function adminDeleteMember(profileId) {
    // cascade will handle household_members and memberships
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId)
    if (error) throw error
}

export async function getAllEventBookings() {
    const { data, error } = await supabase
        .from('event_bookings')
        .select(`
      *,
      profiles (
        first_name,
        last_name,
        email,
        phone
      )
    `)
        .order('event_date', { ascending: true })
    if (error) throw error
    console
    return data
}

export async function insertCheckIn(profileId, seasonId, checkedInBy, membersPresent, guestCount) {
    const { error } = await supabase
        .from('check_ins')
        .insert({
            profile_id: profileId,
            season_id: seasonId,
            checked_in_by: checkedInBy,
            members_present: membersPresent,
            guest_count: guestCount,
        })
    if (error) throw error
}

export async function getCheckInHistory(profileId) {
    const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('profile_id', profileId)
        .order('checked_in_at', { ascending: false })
    if (error) throw error
    return data
}

export async function getAllCheckins(seasonId){
    const {data, error} = await supabase
        .from('check_ins')
        .select('*')
        .eq('season_id', seasonId)
        .order('checked_in_at', {ascending: false})
    if (error) throw error
    //console.log("data", data);
    return data;
}
