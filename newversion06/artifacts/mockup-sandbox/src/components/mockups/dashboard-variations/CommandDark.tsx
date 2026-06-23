import React from 'react';
import { 
  Home, Bot, Share2, CalendarDays, CalendarClock, 
  Camera, Video, Radio, Search, MapPin, BarChart3, 
  Palette, BookOpen, Bell, ArrowUpRight, 
  Clock, CheckCircle2, Command, Users, TrendingUp, Share, Globe
} from 'lucide-react';

export function CommandDark() {
  return (
    <div className="flex min-h-screen w-full font-sans text-sm" style={{ backgroundColor: '#030712', color: '#F8FAFC' }}>
      
      {/* Sidebar */}
      <aside className="flex flex-col w-[220px] flex-shrink-0 border-r" style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
        <div className="h-16 flex items-center px-6 border-b" style={{ borderColor: '#1E293B' }}>
          <div className="w-5 h-5 rounded-sm bg-yellow-500 mr-3 flex-shrink-0"></div>
          <span className="font-bold text-base tracking-tight">MGB</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          
          {/* Group 1: Main */}
          <div>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Main</div>
            <div className="space-y-1">
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium" style={{ backgroundColor: '#1E293B', color: '#818CF8', position: 'relative' }}>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-md" style={{ backgroundColor: '#818CF8' }}></div>
                <Home size={16} className="mr-3" />
                Dashboard
              </a>
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <Bot size={16} className="mr-3" />
                AI Content
              </a>
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <Share2 size={16} className="mr-3" />
                Quick Posts
              </a>
            </div>
          </div>
          
          {/* Group 2: Schedule */}
          <div>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Schedule</div>
            <div className="space-y-1">
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <CalendarDays size={16} className="mr-3" />
                Calendar
              </a>
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <CalendarClock size={16} className="mr-3" />
                Events
              </a>
            </div>
          </div>
          
          {/* Group 3: Media */}
          <div>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Media</div>
            <div className="space-y-1">
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <Camera size={16} className="mr-3" />
                Photo Avatars
              </a>
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <Video size={16} className="mr-3" />
                Video Studio
              </a>
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <Radio size={16} className="mr-3" />
                Streaming
              </a>
            </div>
          </div>
          
          {/* Group 4: Growth */}
          <div>
            <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Growth</div>
            <div className="space-y-1">
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <Search size={16} className="mr-3" />
                SEO
              </a>
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <MapPin size={16} className="mr-3" />
                Local Market
              </a>
              <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
                <BarChart3 size={16} className="mr-3" />
                Analytics
              </a>
            </div>
          </div>
          
        </div>
        
        <div className="p-3 border-t" style={{ borderColor: '#1E293B' }}>
          <div className="space-y-1">
            <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
              <Palette size={16} className="mr-3" />
              Brand Settings
            </a>
            <a href="#" className="flex items-center px-3 py-2 rounded-md font-medium hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
              <BookOpen size={16} className="mr-3" />
              Help
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Header / Command Bar */}
        <header className="h-16 flex items-center px-8 border-b" style={{ backgroundColor: '#030712', borderColor: '#1E293B' }}>
          <div className="flex-1 flex items-center max-w-3xl">
            <Search size={18} style={{ color: '#94A3B8' }} className="mr-3" />
            <input 
              type="text" 
              placeholder="Search or run a command..." 
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-slate-500 text-slate-200"
            />
            <div className="flex items-center justify-center px-2 py-1 rounded border text-xs font-medium" style={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#94A3B8' }}>
              ⌘K
            </div>
          </div>
          
          <div className="ml-auto flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-[#1E293B] transition-colors" style={{ color: '#94A3B8' }}>
              <Bell size={18} />
            </button>
            <div className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#1e1b4b', borderColor: '#312e81', color: '#818CF8' }}>
              JD
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 flex-1 overflow-y-auto">
          
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Top Stats Row */}
            <div className="grid grid-cols-4 gap-4">
              {/* Stat 1 */}
              <div className="p-5 rounded-lg border flex items-center" style={{ backgroundColor: '#111827', borderColor: '#1E293B' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#1e1b4b', color: '#818CF8' }}>
                  <Users size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold mb-0.5">47 <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>Leads</span></div>
                  <div className="flex items-center text-xs font-medium text-emerald-400">
                    <ArrowUpRight size={12} className="mr-1" />
                    12% from last month
                  </div>
                </div>
              </div>
              
              {/* Stat 2 */}
              <div className="p-5 rounded-lg border flex items-center" style={{ backgroundColor: '#111827', borderColor: '#1E293B' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#1e1b4b', color: '#818CF8' }}>
                  <Share size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold mb-0.5">128 <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>Posts</span></div>
                  <div className="flex items-center text-xs font-medium text-emerald-400">
                    <ArrowUpRight size={12} className="mr-1" />
                    8% from last month
                  </div>
                </div>
              </div>
              
              {/* Stat 3 */}
              <div className="p-5 rounded-lg border flex items-center" style={{ backgroundColor: '#111827', borderColor: '#1E293B' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#1e1b4b', color: '#818CF8' }}>
                  <Globe size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold mb-0.5">#4.2 <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>SEO</span></div>
                  <div className="flex items-center text-xs font-medium" style={{ color: '#94A3B8' }}>
                    Average ranking
                  </div>
                </div>
              </div>
              
              {/* Stat 4 */}
              <div className="p-5 rounded-lg border flex items-center" style={{ backgroundColor: '#111827', borderColor: '#1E293B' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4" style={{ backgroundColor: '#1e1b4b', color: '#818CF8' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold mb-0.5">2.4K <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>Social</span></div>
                  <div className="flex items-center text-xs font-medium text-emerald-400">
                    <ArrowUpRight size={12} className="mr-1" />
                    15% from last month
                  </div>
                </div>
              </div>
            </div>

            {/* Modular Panels Grid */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Left Panel: Recent Activity */}
              <div className="rounded-xl border flex flex-col" style={{ backgroundColor: '#111827', borderColor: '#1E293B' }}>
                <div className="px-6 py-5 border-b flex justify-between items-center" style={{ borderColor: '#1E293B' }}>
                  <h3 className="font-semibold text-base">Recent Activity</h3>
                  <button className="text-xs font-medium hover:underline" style={{ color: '#818CF8' }}>View All</button>
                </div>
                
                <div className="flex-1 p-2">
                  <div className="space-y-1">
                    {/* Activity Item 1 */}
                    <div className="flex items-start p-4 hover:bg-[#1E293B] rounded-lg transition-colors group">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-4 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-medium truncate mr-2 text-sm">Just Listed: 1240 Oakwood Drive</span>
                          <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>2h ago</span>
                        </div>
                        <p className="text-xs truncate mb-2" style={{ color: '#94A3B8' }}>Facebook &bull; Beautiful 4-bed, 3-bath property in...</p>
                        <div className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 w-max px-2 py-0.5 rounded">
                          <CheckCircle2 size={12} className="mr-1" /> Published
                        </div>
                      </div>
                    </div>
                    
                    {/* Activity Item 2 */}
                    <div className="flex items-start p-4 hover:bg-[#1E293B] rounded-lg transition-colors group">
                      <div className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 mr-4 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-medium truncate mr-2 text-sm">Market Update October</span>
                          <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>5h ago</span>
                        </div>
                        <p className="text-xs truncate mb-2" style={{ color: '#94A3B8' }}>Instagram &bull; The fall market is heating up! Here are the latest...</p>
                        <div className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 w-max px-2 py-0.5 rounded">
                          <CheckCircle2 size={12} className="mr-1" /> Published
                        </div>
                      </div>
                    </div>
                    
                    {/* Activity Item 3 */}
                    <div className="flex items-start p-4 hover:bg-[#1E293B] rounded-lg transition-colors group">
                      <div className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 mr-4 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-medium truncate mr-2 text-sm">Open House Announcement</span>
                          <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>1d ago</span>
                        </div>
                        <p className="text-xs truncate mb-2" style={{ color: '#94A3B8' }}>Twitter &bull; Join us this Sunday from 1-3PM at our new listing...</p>
                        <div className="flex items-center text-xs font-medium text-amber-400 bg-amber-400/10 w-max px-2 py-0.5 rounded">
                          <Clock size={12} className="mr-1" /> Scheduled
                        </div>
                      </div>
                    </div>
                    
                    {/* Activity Item 4 */}
                    <div className="flex items-start p-4 hover:bg-[#1E293B] rounded-lg transition-colors group">
                      <div className="w-2 h-2 rounded-full bg-blue-700 mt-1.5 mr-4 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-medium truncate mr-2 text-sm">Why Buy in the Midwest?</span>
                          <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>2d ago</span>
                        </div>
                        <p className="text-xs truncate mb-2" style={{ color: '#94A3B8' }}>LinkedIn &bull; Looking for a strong real estate investment? Look no further...</p>
                        <div className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 w-max px-2 py-0.5 rounded">
                          <CheckCircle2 size={12} className="mr-1" /> Published
                        </div>
                      </div>
                    </div>
                    
                    {/* Activity Item 5 */}
                    <div className="flex items-start p-4 hover:bg-[#1E293B] rounded-lg transition-colors group">
                      <div className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 mr-4 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="font-medium truncate mr-2 text-sm">Client Testimonial: The Smiths</span>
                          <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>3d ago</span>
                        </div>
                        <p className="text-xs truncate mb-2" style={{ color: '#94A3B8' }}>Instagram &bull; "Working with MGB was the best decision we made..."</p>
                        <div className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 w-max px-2 py-0.5 rounded">
                          <CheckCircle2 size={12} className="mr-1" /> Published
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
              
              {/* Right Panel: Upcoming Schedule */}
              <div className="rounded-xl border flex flex-col" style={{ backgroundColor: '#111827', borderColor: '#1E293B' }}>
                <div className="px-6 py-5 border-b flex justify-between items-center" style={{ borderColor: '#1E293B' }}>
                  <h3 className="font-semibold text-base">Upcoming Schedule</h3>
                  <button className="text-xs font-medium hover:underline" style={{ color: '#818CF8' }}>Open Calendar</button>
                </div>
                
                <div className="flex-1 p-6">
                  <div className="relative border-l-2 ml-3 space-y-8" style={{ borderColor: '#1E293B' }}>
                    
                    {/* Schedule Item 1 */}
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 rounded-full border-2 -left-[7px] top-1" style={{ borderColor: '#818CF8', backgroundColor: '#111827' }}></div>
                      <div className="text-xs font-semibold mb-1" style={{ color: '#818CF8' }}>Today, 2:00 PM</div>
                      <div className="p-4 rounded-lg border mt-2" style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 rounded-full bg-blue-700 mr-2"></div>
                          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>LinkedIn</span>
                        </div>
                        <p className="text-sm font-medium mb-1 text-white">Q4 Real Estate Trends</p>
                        <p className="text-xs line-clamp-2" style={{ color: '#94A3B8' }}>Sharing my latest thoughts on where the commercial market is heading in Q4. Link to full article below...</p>
                      </div>
                    </div>
                    
                    {/* Schedule Item 2 */}
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 rounded-full border-2 -left-[7px] top-1" style={{ borderColor: '#1E293B', backgroundColor: '#111827' }}></div>
                      <div className="text-xs font-semibold mb-1" style={{ color: '#94A3B8' }}>Tomorrow, 9:00 AM</div>
                      <div className="p-4 rounded-lg border mt-2" style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 rounded-full bg-pink-500 mr-2"></div>
                          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>Instagram</span>
                        </div>
                        <p className="text-sm font-medium mb-1 text-white">Behind the Scenes: 808 West St</p>
                        <p className="text-xs line-clamp-2" style={{ color: '#94A3B8' }}>Sneak peek of our upcoming luxury listing! The finishes on this one are incredible. 🏡✨ #luxuryrealestate...</p>
                      </div>
                    </div>
                    
                    {/* Schedule Item 3 */}
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 rounded-full border-2 -left-[7px] top-1" style={{ borderColor: '#1E293B', backgroundColor: '#111827' }}></div>
                      <div className="text-xs font-semibold mb-1" style={{ color: '#94A3B8' }}>Oct 24, 11:30 AM</div>
                      <div className="p-4 rounded-lg border mt-2" style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>Facebook</span>
                        </div>
                        <p className="text-sm font-medium mb-1 text-white">Community Highlight: Maplewood</p>
                        <p className="text-xs line-clamp-2" style={{ color: '#94A3B8' }}>Why is everyone moving to Maplewood? Great schools, amazing parks, and a thriving downtown area...</p>
                      </div>
                    </div>

                    {/* Schedule Item 4 */}
                    <div className="relative pl-6">
                      <div className="absolute w-3 h-3 rounded-full border-2 -left-[7px] top-1" style={{ borderColor: '#1E293B', backgroundColor: '#111827' }}></div>
                      <div className="text-xs font-semibold mb-1" style={{ color: '#94A3B8' }}>Oct 26, 4:00 PM</div>
                      <div className="p-4 rounded-lg border mt-2" style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 rounded-full bg-sky-400 mr-2"></div>
                          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>Twitter</span>
                        </div>
                        <p className="text-sm font-medium mb-1 text-white">Mortgage Rate Update</p>
                        <p className="text-xs line-clamp-2" style={{ color: '#94A3B8' }}>Rates dipped slightly this week! If you've been waiting on the sidelines, now might be the time to make a move...</p>
                      </div>
                    </div>

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
