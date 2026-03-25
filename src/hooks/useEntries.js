import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Hook for managing timesheet entries
export function useEntries() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch entries for a specific week
  const fetchWeekEntries = useCallback(async (userId, weekEnding) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('week_ending', weekEnding)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (err) throw err
      return data || []
    } catch (e) {
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch all entries for a user (for My Entries page)
  const fetchUserEntries = useCallback(async (userId, options = {}) => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('timesheet_entries')
        .select('*, projects(name)')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (options.monthStart) {
        const monthEnd = new Date(options.monthStart + 'T12:00:00')
        monthEnd.setMonth(monthEnd.getMonth() + 1)
        query = query
          .gte('entry_date', options.monthStart)
          .lt('entry_date', monthEnd.toISOString().slice(0, 10))
      }

      if (options.limit) {
        query = query.limit(options.limit)
      }

      const { data, error: err } = await query
      if (err) throw err
      return data || []
    } catch (e) {
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch all entries (admin view)
  const fetchAllEntries = useCallback(async (options = {}) => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('timesheet_entries')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order('entry_date', { ascending: false })

      if (options.monthStart) {
        const monthEnd = new Date(options.monthStart + 'T12:00:00')
        monthEnd.setMonth(monthEnd.getMonth() + 1)
        query = query
          .gte('entry_date', options.monthStart)
          .lt('entry_date', monthEnd.toISOString().slice(0, 10))
      }

      if (options.userId) {
        query = query.eq('user_id', options.userId)
      }

      const { data, error: err } = await query
      if (err) throw err
      return data || []
    } catch (e) {
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Insert multiple entries (batch submit)
  const submitEntries = useCallback(async (entries) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('timesheet_entries')
        .insert(entries)
        .select()

      if (err) throw err
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // Update a single entry
  const updateEntry = useCallback(async (entryId, updates) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('timesheet_entries')
        .update(updates)
        .eq('id', entryId)
        .select()

      if (err) throw err
      return data?.[0] || null
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // Delete an entry (only drafts)
  const deleteEntry = useCallback(async (entryId) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('timesheet_entries')
        .delete()
        .eq('id', entryId)

      if (err) throw err
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // Mark entries as submitted for a week (handles both draft and returned)
  const submitWeek = useCallback(async (userId, weekEnding) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('timesheet_entries')
        .update({ status: 'submitted', return_reason: null, returned_by: null })
        .eq('user_id', userId)
        .eq('week_ending', weekEnding)
        .in('status', ['draft', 'returned'])
        .select()

      if (err) throw err
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // Return entries for a week (admin action)
  const returnWeekEntries = useCallback(async (userId, weekEnding, reason = null) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('return_week_entries', {
        p_user_id: userId,
        p_week_ending: weekEnding,
        p_reason: reason,
      })
      if (err) throw err
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // Return a single entry (admin action)
  const returnEntry = useCallback(async (entryId, reason = null) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('return_entry', {
        p_entry_id: entryId,
        p_reason: reason,
      })
      if (err) throw err
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    fetchWeekEntries,
    fetchUserEntries,
    fetchAllEntries,
    submitEntries,
    updateEntry,
    deleteEntry,
    submitWeek,
    returnWeekEntries,
    returnEntry,
  }
}

// Hook for admin sign-off operations
export function useSignoffs() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSignoffs = useCallback(async (monthStart) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('monthly_signoffs')
        .select(`
          *,
          profiles:user_id (full_name, email),
          signer:signed_off_by (full_name)
        `)
        .eq('month_start', monthStart)

      if (err) throw err
      return data || []
    } catch (e) {
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const signOffMonth = useCallback(async (userId, monthStart, notes = null) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('sign_off_month', {
        p_user_id: userId,
        p_month_start: monthStart,
        p_notes: notes,
      })
      if (err) throw err
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const revokeSignoff = useCallback(async (userId, monthStart) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('revoke_signoff', {
        p_user_id: userId,
        p_month_start: monthStart,
      })
      if (err) throw err
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAdminSummary = useCallback(async (monthStart) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('get_admin_summary', {
        p_month_start: monthStart,
      })
      if (err) throw err
      return data || []
    } catch (e) {
      setError(e.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const signOffWeek = useCallback(async (userId, weekEnding) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('sign_off_week', {
        p_user_id: userId,
        p_week_ending: weekEnding,
      })
      if (err) throw err
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const unsignOffWeek = useCallback(async (userId, weekEnding) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('unsign_off_week', {
        p_user_id: userId,
        p_week_ending: weekEnding,
      })
      if (err) throw err
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    fetchSignoffs,
    signOffMonth,
    revokeSignoff,
    signOffWeek,
    unsignOffWeek,
    fetchAdminSummary,
  }
}
