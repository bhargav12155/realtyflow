import React from "react";
import { 
  Home, 
  Bot, 
  Share2, 
  Calendar, 
  Video, 
  Search, 
  MapPin, 
  Palette, 
  BarChart3, 
  Settings,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  MessageCircle,
  Plus
} from "lucide-react";

export function ScorecardDark() {
  const sidebarIcons = [
    { icon: Home, active: true },
    { icon: Bot, active: false },
    { icon: Share2, active: false },
    { icon: Calendar, active: false },
    { icon: Video, active: false },
    { icon: Search, active: false },
    { icon: MapPin, active: false },
    { icon: Palette, active: false },
    { icon: BarChart3, active: false },
  ];

  const statCards = [
    { 
      title: "Monthly Leads", 
      value: "47", 
      change: "+12.3%", 
      positive: true,
      sparkline: "M0 20 Q 10 15, 20 18 T 40 10 T 60 12 T 80 5 T 100 0"
    },
    { 
      title: "Content Published", 
      value: "128", 
      change: "+8.1%", 
      positive: true,
      sparkline: "M0 15 Q 15 20, 25 10 T 50 15 T 75 5 T 100 2"
    },
    { 
      title: "SEO Ranking", 
      value: "4.2", 
      subtitle: "(avg position)", 
      change: "+0.4", 
      positive: true,
      sparkline: "M0 5 Q 20 8, 40 5 T 60 10 T 80 8 T 100 2"
    },
    { 
      title: "Social Engagement", 
      value: "2.4K", 
      subtitle: "(interactions)", 
      change: "-2.1%", 
      positive: false,
      sparkline: "M0 5 Q 20 2, 40 8 T 60 5 T 80 15 T 100 20"
    },
  ];

  const activityFeed = [
    { platform: Facebook, color: "text-[#3b82f6]", content: "Just Listed: 1234 Maple Dr. Open house this Saturday...", time: "2h ago", agent: "Sarah Jenkins" },
    { platform: Instagram, color: "text-[#ec4899]", content: "Beautiful modern kitchen at our newest Omaha listing. ✨", time: "4h ago", agent: "Mike Thompson" },
    { platform: Linkedin, color: "text-[#1d4ed8]", content: "Q3 Market Report: Omaha real estate continues strong growth.", time: "5h ago", agent: "Sarah Jenkins" },
    { platform: MessageCircle, color: "text-[#22c55e]", content: "Automated response sent to 4 leads from Facebook campaign.", time: "6h ago", agent: "AI Assistant" },
    { platform: Twitter, color: "text-[#e2e8f0]", content: "Mortgage rates dropped slightly this week. Good time to buy! 🏡", time: "8h ago", agent: "Mike Thompson" },
    { platform: Youtube, color: "text-[#ef4444]", content: "Video Tour Published: 5592 Pine Tree Lane luxury estate.", time: "1d ago", agent: "Sarah Jenkins" },
    { platform: Facebook, color: "text-[#3b82f6]", content: "Price Reduction! 8820 West Dodge Rd. Now asking $425k.", time: "1d ago", agent: "Mike Thompson" },
  ];

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const scheduledDays = [2, 5, 8, 12, 14, 15, 18, 22, 25, 26, 28];

  return (
    <div className="min-h-screen flex text-[13px] font-sans" style={{ backgroundColor: "#0C0A09", color: "#FAFAF9" }}>
      {/* Sidebar */}
      <aside className="w-14 flex-shrink-0 flex flex-col items-center py-4 border-r" style={{ borderColor: "#292524", backgroundColor: "#1C1917" }}>
        <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm mb-6">GB</div>
        <div className="flex-1 flex flex-col space-y-6 w-full items-center">
          {sidebarIcons.map((item, i) => (
            <button key={i} className={`p-2 rounded-md transition-colors ${item.active ? 'bg-[#292524] text-[#FAFAF9]' : 'text-[#A8A29E] hover:text-[#FAFAF9] hover:bg-[#292524]'}`}>
              <item.icon size={18} strokeWidth={2} />
            </button>
          ))}
        </div>
        <div className="mt-auto pt-6 border-t w-full flex justify-center" style={{ borderColor: "#292524" }}>
          <button className="p-2 text-[#A8A29E] hover:text-[#FAFAF9] rounded-md hover:bg-[#292524]">
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b" style={{ borderColor: "#292524", backgroundColor: "#1C1917" }}>
          <div>
            <h1 className="font-semibold text-[15px]" style={{ color: "#FAFAF9" }}>AI SEO & Social Media Dashboard</h1>
          </div>
          <button className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors">
            <Plus size={14} />
            <span>Generate Content</span>
          </button>
        </header>

        {/* Dashboard Content */}
        <div className="p-6 flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-4">
              {statCards.map((stat, i) => (
                <div key={i} className="border rounded-sm p-4 flex flex-col justify-between h-28" style={{ backgroundColor: "#1C1917", borderColor: "#292524" }}>
                  <div className="flex justify-between items-start">
                    <div style={{ color: "#A8A29E" }} className="text-xs uppercase tracking-wider font-semibold">{stat.title}</div>
                    <div className={`text-xs font-medium ${stat.positive ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                      {stat.change}
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold leading-none" style={{ color: "#FAFAF9" }}>{stat.value}</div>
                      {stat.subtitle && <div className="text-xs mt-1" style={{ color: "#A8A29E" }}>{stat.subtitle}</div>}
                    </div>
                    <div className="w-16 h-8">
                      <svg width="100%" height="100%" viewBox="0 0 100 25" preserveAspectRatio="none">
                        <path 
                          d={stat.sparkline} 
                          fill="none" 
                          stroke={stat.positive ? "#10b981" : "#f43f5e"} 
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-3 gap-6">
              
              {/* Activity Feed */}
              <div className="col-span-2 flex flex-col space-y-4">
                <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: "#FAFAF9" }}>Recent Activity</h2>
                <div className="border rounded-sm flex flex-col" style={{ backgroundColor: "#1C1917", borderColor: "#292524" }}>
                  {activityFeed.map((item, i) => (
                    <div key={i} className={`flex items-start p-3 ${i !== activityFeed.length - 1 ? 'border-b' : ''}`} style={{ borderColor: "#292524" }}>
                      <div className={`mt-0.5 ${item.color}`}>
                        <item.platform size={16} />
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="font-medium" style={{ color: "#FAFAF9" }}>{item.content}</div>
                        <div className="flex items-center justify-between mt-1 text-xs" style={{ color: "#A8A29E" }}>
                          <span>{item.agent}</span>
                          <span>{item.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Modules */}
              <div className="col-span-1 flex flex-col space-y-6">
                
                {/* Calendar Widget */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: "#FAFAF9" }}>Content Calendar</h2>
                    <span className="text-xs font-medium text-blue-500">October 2025</span>
                  </div>
                  <div className="border rounded-sm p-4" style={{ backgroundColor: "#1C1917", borderColor: "#292524" }}>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 font-medium" style={{ color: "#A8A29E" }}>
                      <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {/* Empty days for offset */}
                      <div className="aspect-square"></div>
                      <div className="aspect-square"></div>
                      <div className="aspect-square"></div>
                      
                      {daysInMonth.map(day => {
                        const isScheduled = scheduledDays.includes(day);
                        const isToday = day === 15;
                        return (
                          <div 
                            key={day} 
                            className={`aspect-square flex items-center justify-center text-xs relative
                              ${isToday ? 'bg-blue-600 text-white font-bold rounded' : ''}
                              ${!isToday ? 'hover:bg-[#292524] cursor-pointer rounded' : ''}
                            `}
                            style={!isToday ? { color: "#FAFAF9" } : {}}
                          >
                            {day}
                            {isScheduled && !isToday && (
                              <div className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h2 className="font-semibold text-sm uppercase tracking-wide mb-4" style={{ color: "#FAFAF9" }}>Quick Actions</h2>
                  <div className="border rounded-sm flex flex-col" style={{ backgroundColor: "#1C1917", borderColor: "#292524" }}>
                    <button className="flex items-center p-3 hover:bg-[#292524] border-b text-left transition-colors" style={{ borderColor: "#292524" }}>
                      <Video size={16} className="text-[#3b82f6] mr-3" />
                      <div>
                        <div className="font-medium" style={{ color: "#FAFAF9" }}>Create Video Tour</div>
                        <div className="text-xs mt-0.5" style={{ color: "#A8A29E" }}>Generate property video from photos</div>
                      </div>
                    </button>
                    <button className="flex items-center p-3 hover:bg-[#292524] border-b text-left transition-colors" style={{ borderColor: "#292524" }}>
                      <MessageCircle size={16} className="text-[#22c55e] mr-3" />
                      <div>
                        <div className="font-medium" style={{ color: "#FAFAF9" }}>Bulk WhatsApp Message</div>
                        <div className="text-xs mt-0.5" style={{ color: "#A8A29E" }}>Send templates to your lead list</div>
                      </div>
                    </button>
                    <button className="flex items-center p-3 hover:bg-[#292524] text-left transition-colors">
                      <BarChart3 size={16} className="text-[#a855f7] mr-3" />
                      <div>
                        <div className="font-medium" style={{ color: "#FAFAF9" }}>Generate SEO Report</div>
                        <div className="text-xs mt-0.5" style={{ color: "#A8A29E" }}>Analyze local market rankings</div>
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
