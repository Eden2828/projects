'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils/cn'
import {
  User, Bell, Shield, Link, Moon, Sun, Monitor, Save, Plus,
  Trash2, Eye, EyeOff, RefreshCw, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Link },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const { profile, refreshProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const qc = useQueryClient()

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" subtitle="Manage your account and preferences" />

      <div className="flex-1 overflow-auto">
        <div className="flex h-full">
          {/* Settings sidebar */}
          <div className="w-56 border-r border-border p-4 space-y-1 flex-shrink-0">
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'sidebar-link w-full',
                    activeTab === tab.id && 'sidebar-link-active'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Settings content */}
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-2xl">
              {activeTab === 'profile' && <ProfileSettings />}
              {activeTab === 'notifications' && <NotificationSettings />}
              {activeTab === 'security' && <SecuritySettings />}
              {activeTab === 'integrations' && <IntegrationSettings />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileSettings() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  const saveProfile = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile?.id)

      if (error) throw error
      await refreshProfile()
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Profile</h2>
        <p className="text-sm text-muted-foreground">Your account information</p>
      </div>

      <div className="card p-6 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-gradient flex items-center justify-center text-white text-2xl font-bold">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-medium">{profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <span className="badge bg-brand-600/10 text-brand-400 border-brand-600/20 text-xs mt-1 capitalize">
              {profile?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Full Name</label>
          <input
            className="input"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
        </div>

        <button
          onClick={saveProfile}
          disabled={saving || fullName === profile?.full_name}
          className="btn-primary gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Appearance */}
      <div className="card p-6">
        <h3 className="font-medium mb-4">Appearance</h3>
        <div className="flex items-center gap-3">
          {(['light', 'dark', 'system'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all capitalize',
                theme === t
                  ? 'border-brand-600 bg-brand-600/10 text-brand-400'
                  : 'border-border hover:border-brand-600/40 text-muted-foreground'
              )}
            >
              {t === 'light' ? <Sun className="w-4 h-4" /> :
               t === 'dark' ? <Moon className="w-4 h-4" /> :
               <Monitor className="w-4 h-4" />}
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationSettings() {
  const { profile } = useAuth()
  const [emailNotifs, setEmailNotifs] = useState(profile?.preferences?.notifications?.email ?? true)
  const [browserNotifs, setBrowserNotifs] = useState(profile?.preferences?.notifications?.browser ?? true)
  const supabase = createClient()

  const save = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({
        preferences: {
          ...profile?.preferences,
          notifications: { email: emailNotifs, browser: browserNotifs }
        }
      })
      .eq('id', profile?.id)

    if (!error) toast.success('Notification preferences saved')
    else toast.error('Failed to save')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Notifications</h2>
        <p className="text-sm text-muted-foreground">Manage how you receive alerts</p>
      </div>

      <div className="card p-6 space-y-4">
        <ToggleRow
          label="Email Notifications"
          description="Receive critical alerts via email"
          checked={emailNotifs}
          onChange={setEmailNotifs}
        />
        <ToggleRow
          label="Browser Notifications"
          description="Get real-time alerts in the browser"
          checked={browserNotifs}
          onChange={setBrowserNotifs}
        />
        <button onClick={save} className="btn-primary gap-2 mt-2">
          <Save className="w-4 h-4" />
          Save Preferences
        </button>
      </div>
    </div>
  )
}

function SecuritySettings() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const supabase = createClient()

  const changePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) toast.error(error.message)
    else { toast.success('Password updated'); setCurrentPw(''); setNewPw('') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Security</h2>
        <p className="text-sm text-muted-foreground">Manage your account security</p>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-medium">Change Password</h3>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            className="input pr-10"
            placeholder="New password (min 8 chars)"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={changePassword}
          disabled={newPw.length < 8}
          className="btn-primary"
        >
          Update Password
        </button>
      </div>
    </div>
  )
}

function IntegrationSettings() {
  const supabase = createClient()

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['all-accounts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ad_accounts')
        .select('*, client:clients(name)')
        .eq('is_active', true)
      return data || []
    },
  })

  const syncAll = async () => {
    await fetch('/api/meta/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_all: true }),
    })
    toast.success('Sync started for all accounts')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Integrations</h2>
        <p className="text-sm text-muted-foreground">Manage Meta Ads connections</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Meta Ad Accounts</h3>
          <button onClick={syncAll} className="btn-secondary gap-2 text-sm">
            <RefreshCw className="w-3.5 h-3.5" />
            Sync All
          </button>
        </div>

        <div className="space-y-2">
          {(accounts as Array<{
            id: string; meta_account_id: string; account_name: string;
            sync_status: string; last_synced_at: string | null; client: { name: string } | null
          }>).map(acc => (
            <div key={acc.id} className="flex items-center gap-3 p-3 bg-surface rounded-lg text-sm">
              <div className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                acc.sync_status === 'success' ? 'bg-emerald-400' :
                acc.sync_status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'
              )} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{acc.account_name}</p>
                <p className="text-xs text-muted-foreground">
                  {acc.client?.name} · act_{acc.meta_account_id}
                </p>
              </div>
              <span className="text-xs text-muted-foreground capitalize">{acc.sync_status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-6 rounded-full transition-all duration-200 flex-shrink-0',
          checked ? 'bg-brand-600' : 'bg-muted'
        )}
      >
        <span className={cn(
          'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200',
          checked ? 'left-5' : 'left-1'
        )} />
      </button>
    </div>
  )
}
