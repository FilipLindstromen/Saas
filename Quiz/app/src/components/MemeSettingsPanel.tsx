import React from 'react'
import { MemeSettings } from '../types'
import { LabeledSlider } from './LabeledSlider'

interface MemeSettingsPanelProps {
  settings: MemeSettings
  onUpdate: (updater: (settings: MemeSettings) => MemeSettings) => void
}

export function MemeSettingsPanel({ settings, onUpdate }: MemeSettingsPanelProps) {
  return (
    <div className="space-y-4">

      {/* Text Toggles */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={settings.showTopText ?? true} 
            onChange={e => onUpdate(s => ({ ...s, showTopText: e.target.checked }))} 
          />
          Show Top Text
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={settings.showBottomText ?? true} 
            onChange={e => onUpdate(s => ({ ...s, showBottomText: e.target.checked }))} 
          />
          Show Bottom Text
        </label>
      </div>

      {/* Global Text Size */}
      <div>
        <LabeledSlider
          label="Overall Text Size"
          value={((settings.topTextSizePercent ?? 8) + (settings.bottomTextSizePercent ?? 8)) / 2}
          min={2}
          max={20}
          step={0.5}
          onChange={(value) => onUpdate(s => ({
            ...s,
            topTextSizePercent: value,
            bottomTextSizePercent: value
          }))}
          unit="%"
        />
      </div>

      {/* Text Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-iossub mb-1">Top Text Color</label>
          <input
            type="color"
            value={settings.topTextColor}
            onChange={(e) => onUpdate(s => ({ ...s, topTextColor: e.target.value }))}
            className="ios-input w-full h-10"
          />
        </div>
        <div>
          <label className="block text-sm text-iossub mb-1">Bottom Text Color</label>
          <input
            type="color"
            value={settings.bottomTextColor}
            onChange={(e) => onUpdate(s => ({ ...s, bottomTextColor: e.target.value }))}
            className="ios-input w-full h-10"
          />
        </div>
      </div>


      {/* Text Sizes */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <LabeledSlider
            label="Top Text Size"
            value={settings.topTextSizePercent || 8}
            min={2}
            max={20}
            step={0.5}
            onChange={(value) => onUpdate(s => ({ ...s, topTextSizePercent: value }))}
            unit="%"
          />
        </div>
        <div>
          <LabeledSlider
            label="Bottom Text Size"
            value={settings.bottomTextSizePercent || 8}
            min={2}
            max={20}
            step={0.5}
            onChange={(value) => onUpdate(s => ({ ...s, bottomTextSizePercent: value }))}
            unit="%"
          />
        </div>
      </div>

      {/* Text Positions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <LabeledSlider
            label="Top Text Distance from Top"
            value={settings.topTextDistanceFromTop || 5}
            min={0}
            max={40}
            step={1}
            onChange={(value) => onUpdate(s => ({ ...s, topTextDistanceFromTop: value }))}
            unit="%"
          />
        </div>
        <div>
          <LabeledSlider
            label="Bottom Text Distance from Bottom"
            value={settings.bottomTextDistanceFromBottom || 5}
            min={0}
            max={40}
            step={1}
            onChange={(value) => onUpdate(s => ({ ...s, bottomTextDistanceFromBottom: value }))}
            unit="%"
          />
        </div>
      </div>

      {/* Text Shadows */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={settings.topTextShadowEnabled ?? true} 
            onChange={e => onUpdate(s => ({ ...s, topTextShadowEnabled: e.target.checked }))} 
          />
          Top Text Shadow
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={settings.bottomTextShadowEnabled ?? true} 
            onChange={e => onUpdate(s => ({ ...s, bottomTextShadowEnabled: e.target.checked }))} 
          />
          Bottom Text Shadow
        </label>
      </div>

      {/* Shadow Colors */}
      {(settings.topTextShadowEnabled || settings.bottomTextShadowEnabled) && (
        <div className="grid grid-cols-2 gap-3">
          {settings.topTextShadowEnabled && (
            <div>
              <label className="block text-sm text-iossub mb-1">Top Shadow Color</label>
              <input
                type="color"
                value={settings.topTextShadowColor || '#000000'}
                onChange={(e) => onUpdate(s => ({ ...s, topTextShadowColor: e.target.value }))}
                className="ios-input w-full h-10"
              />
            </div>
          )}
          {settings.bottomTextShadowEnabled && (
            <div>
              <label className="block text-sm text-iossub mb-1">Bottom Shadow Color</label>
              <input
                type="color"
                value={settings.bottomTextShadowColor || '#000000'}
                onChange={(e) => onUpdate(s => ({ ...s, bottomTextShadowColor: e.target.value }))}
                className="ios-input w-full h-10"
              />
            </div>
          )}
        </div>
      )}

      {/* Color Overlay (appears above background, below text) */}
      <div className="space-y-3">
        <div className="text-sm text-iossub">Color Overlay (appears below text)</div>
        
        <div>
          <label className="block text-sm text-iossub mb-1">Overlay Color</label>
          <input
            type="color"
            value={settings.overlayColor || '#000000'}
            onChange={(e) => onUpdate(s => ({ ...s, overlayColor: e.target.value }))}
            className="ios-input w-full h-10"
          />
        </div>

        <div>
          <LabeledSlider
            label="Overlay Opacity"
            value={settings.overlayOpacity || 0.3}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => onUpdate(s => ({ ...s, overlayOpacity: value }))}
            unit=""
          />
        </div>
      </div>

      {/* Text Background */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={settings.textBackgroundEnabled ?? false} 
            onChange={e => onUpdate(s => ({ ...s, textBackgroundEnabled: e.target.checked }))} 
          />
          Text Background
        </label>

        {settings.textBackgroundEnabled && (
          <div>
            <label className="block text-sm text-iossub mb-1">Background Color</label>
            <input
              type="color"
              value={settings.textBackgroundColor || '#000000'}
              onChange={(e) => onUpdate(s => ({ ...s, textBackgroundColor: e.target.value }))}
              className="ios-input w-full h-10"
            />
          </div>
        )}
      </div>

      {/* Animation Timing */}
      <div className="space-y-3">
        <div className="text-sm text-iossub mb-2">Animation Timing</div>
        <div className="grid grid-cols-2 gap-3">
          <LabeledSlider
            label="Top Text Fade In (ms)"
            value={settings.topTextInMs || 500}
            min={100}
            max={2000}
            step={100}
            onChange={(value) => onUpdate(s => ({ ...s, topTextInMs: value }))}
            unit="ms"
          />
          <LabeledSlider
            label="Bottom Text Fade In (ms)"
            value={settings.bottomTextInMs || 500}
            min={100}
            max={2000}
            step={100}
            onChange={(value) => onUpdate(s => ({ ...s, bottomTextInMs: value }))}
            unit="ms"
          />
          <LabeledSlider
            label="Top Text Hold Time (ms)"
            value={settings.topTextHoldMs || 3000}
            min={1000}
            max={10000}
            step={100}
            onChange={(value) => onUpdate(s => ({ ...s, topTextHoldMs: value }))}
            unit="ms"
          />
          <LabeledSlider
            label="Bottom Text Hold Time (ms)"
            value={settings.bottomTextHoldMs || 3000}
            min={1000}
            max={10000}
            step={100}
            onChange={(value) => onUpdate(s => ({ ...s, bottomTextHoldMs: value }))}
            unit="ms"
          />
          <LabeledSlider
            label="Top Text Fade Out (ms)"
            value={settings.topTextFadeOutMs || 500}
            min={100}
            max={2000}
            step={100}
            onChange={(value) => onUpdate(s => ({ ...s, topTextFadeOutMs: value }))}
            unit="ms"
          />
          <LabeledSlider
            label="Bottom Text Fade Out (ms)"
            value={settings.bottomTextFadeOutMs || 500}
            min={100}
            max={2000}
            step={100}
            onChange={(value) => onUpdate(s => ({ ...s, bottomTextFadeOutMs: value }))}
            unit="ms"
          />
        </div>
      </div>

    </div>
  )
}


