import React from 'react'

const PlaceholderPage: React.FC<{ title: string; description: string; icon: string }> = ({
  title,
  description,
  icon,
}) => (
  <div className="flex items-center justify-center h-full animate-fade-in">
    <div className="text-center max-w-sm">
      <div className="text-4xl mb-3">{icon}</div>
      <h2 className="font-display text-lg font-bold text-osrs-text tracking-wide mb-2">
        {title}
      </h2>
      <p className="text-sm text-osrs-text-dim font-body leading-relaxed">
        {description}
      </p>
    </div>
  </div>
)

export const CalculatorsPage: React.FC = () => (
  <PlaceholderPage
    title="Skill Calculators"
    description="Calculate XP requirements, actions needed, and costs for any skill and method. Coming soon."
    icon="🧮"
  />
)

export const QuestsPage: React.FC = () => (
  <PlaceholderPage
    title="Quest Tracker"
    description="Track quest completion, check skill requirements, and see which quests you can complete with boostable levels. Coming soon."
    icon="📜"
  />
)

export const HistoryPage: React.FC = () => (
  <PlaceholderPage
    title="Session History"
    description="View past training sessions, XP over time charts, and historical performance data. Coming soon."
    icon="📈"
  />
)
