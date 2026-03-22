import { Bot, Share2, Calendar, Video, Search, BarChart3, Bell, Sparkles, Clock, CheckCircle2, XCircle, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';

export function FeedDark() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-300 font-sans selection:bg-[#F59E0B] selection:text-black">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-[#09090B]/80 backdrop-blur-md border-b border-[#27272A] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B] flex items-center justify-center">
              <span className="text-black font-bold text-sm">GB</span>
            </div>
            <span className="font-serif font-bold text-xl tracking-tight text-[#FAFAFA]">My Golden Brick LLC</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-[#A1A1AA]">
            <a href="#" className="text-[#F59E0B] transition-colors">Dashboard</a>
            <a href="#" className="hover:text-[#FAFAFA] transition-colors">Content</a>
            <a href="#" className="hover:text-[#FAFAFA] transition-colors">Calendar</a>
            <a href="#" className="hover:text-[#FAFAFA] transition-colors">Video</a>
            <a href="#" className="hover:text-[#FAFAFA] transition-colors">SEO</a>
            <a href="#" className="hover:text-[#FAFAFA] transition-colors">Social</a>
            <a href="#" className="hover:text-[#FAFAFA] transition-colors">Analytics</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="bg-[#F59E0B] hover:bg-[#D97706] text-black px-4 py-2 rounded-full font-medium text-sm transition-colors flex items-center gap-2 shadow-sm">
              <Sparkles className="w-4 h-4" />
              Generate Content
            </button>
            <div className="w-9 h-9 rounded-full bg-zinc-800 border-2 border-[#27272A] shadow-sm overflow-hidden">
              <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-[720px] mx-auto pt-12 pb-24 px-4 sm:px-6">
        
        {/* Stats Header */}
        <div className="mb-16">
          <h1 className="font-serif text-3xl font-bold mb-8 text-[#FAFAFA]">Overview</h1>
          <div className="grid grid-cols-4 gap-8">
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-[#FAFAFA] mb-1">47</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wider">Leads</span>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">+12.3%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-[#FAFAFA] mb-1">128</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wider">Published</span>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">+4.2%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-[#FAFAFA] mb-1">4.2</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wider">SEO Score</span>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">+0.8</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-[#FAFAFA] mb-1">2.4K</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wider">Engagement</span>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">+18.5%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Feed */}
        <div className="space-y-8">
          <div className="flex items-center justify-between mb-8 border-b border-[#27272A] pb-4">
            <h2 className="font-serif text-2xl font-bold text-[#FAFAFA]">Activity & Schedule</h2>
            <button className="text-sm font-medium text-[#A1A1AA] hover:text-[#FAFAFA] flex items-center gap-2 transition-colors">
              Filter <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Item 1: Scheduled LinkedIn */}
          <article className="group bg-[#18181B] border border-[#27272A] rounded-2xl p-6 sm:p-8 hover:border-zinc-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-[#3B82F6]">
                  <Linkedin className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-[#FAFAFA]">LinkedIn Network</div>
                  <div className="text-sm text-[#A1A1AA] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Scheduled for Tomorrow, 9:00 AM
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 text-[#F59E0B] text-xs font-semibold rounded-full border border-amber-500/20">
                Scheduled
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Market Update</span>
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Dundee</span>
            </div>
            <h3 className="text-xl font-bold text-[#FAFAFA] mb-3 leading-snug">Q3 Market Analysis: Dundee Neighborhood Trends</h3>
            <p className="text-zinc-400 text-base leading-relaxed mb-6">
              The Dundee real estate market continues to show strong resilience. Average days on market have decreased by 14% compared to last quarter, while median sale prices remain steady...
            </p>
            <div className="flex items-center gap-4 text-sm font-medium text-[#A1A1AA] border-t border-[#27272A] pt-4">
              <button className="hover:text-[#FAFAFA] transition-colors">Edit Post</button>
              <button className="hover:text-[#FAFAFA] transition-colors">Reschedule</button>
            </div>
          </article>

          {/* Item 2: Delivered Instagram */}
          <article className="group bg-[#18181B] border border-[#27272A] rounded-2xl p-6 sm:p-8 hover:border-zinc-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-[#EC4899]">
                  <Instagram className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-[#FAFAFA]">Instagram Feed</div>
                  <div className="text-sm text-[#A1A1AA] flex items-center gap-1.5">
                    2 hours ago
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Delivered
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Just Listed</span>
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Video Tour</span>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-3 leading-snug">Stunning Modern Farmhouse at 456 Oak Ave</h3>
                <p className="text-zinc-400 text-base leading-relaxed mb-6">
                  Just listed this incredible 4 bed, 3.5 bath modern farmhouse! Featuring a chef's kitchen, soaring 12ft ceilings, and a backyard oasis perfect for entertaining. 🏡✨ Drop a comment if you want the link to the full virtual tour!
                </p>
                <div className="flex items-center gap-6 text-sm font-medium text-[#A1A1AA] border-t border-[#27272A] pt-4">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400"></div> 342 Likes</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div> 28 Comments</span>
                </div>
              </div>
              <div className="w-32 h-40 bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0 relative group-hover:shadow-md transition-shadow">
                 <img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&q=80" alt="House exterior" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                   <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/30">
                     <Video className="w-4 h-4 ml-0.5" />
                   </div>
                 </div>
              </div>
            </div>
          </article>

          {/* Item 3: Delivered Facebook */}
          <article className="group bg-[#18181B] border border-[#27272A] rounded-2xl p-6 sm:p-8 hover:border-zinc-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-[#3B82F6]">
                  <Facebook className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-[#FAFAFA]">Facebook Business Page</div>
                  <div className="text-sm text-[#A1A1AA] flex items-center gap-1.5">
                    Yesterday, 4:30 PM
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Delivered
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Open House</span>
            </div>
            <h3 className="text-xl font-bold text-[#FAFAFA] mb-3 leading-snug">Weekend Open House: 123 Maple St</h3>
            <p className="text-zinc-400 text-base leading-relaxed mb-6">
              Join us this Saturday from 1-3 PM for an exclusive look at this beautifully renovated historic home in the heart of the city. Light refreshments will be served!
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="h-48 bg-zinc-800 rounded-xl overflow-hidden">
                <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80" alt="Living room" className="w-full h-full object-cover" />
              </div>
              <div className="h-48 bg-zinc-800 rounded-xl overflow-hidden">
                <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80" alt="Kitchen" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-[#A1A1AA] border-t border-[#27272A] pt-4">
              <button className="hover:text-[#FAFAFA] transition-colors flex items-center gap-2"><BarChart3 className="w-4 h-4" /> View Insights</button>
              <button className="hover:text-[#FAFAFA] transition-colors flex items-center gap-2"><Share2 className="w-4 h-4" /> Boost Post</button>
            </div>
          </article>

          {/* Item 4: Failed X/Twitter */}
          <article className="group bg-[#18181B] border border-[#27272A] rounded-2xl p-6 sm:p-8 hover:border-zinc-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[#FAFAFA]">
                  <Twitter className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-[#FAFAFA]">X (Twitter)</div>
                  <div className="text-sm text-[#A1A1AA] flex items-center gap-1.5">
                    Yesterday, 10:00 AM
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                <XCircle className="w-4 h-4" /> Failed
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Market Update</span>
            </div>
            <div className="p-4 bg-red-950/30 text-red-300 text-sm rounded-xl mb-4 border border-red-900/50">
              <strong className="font-medium text-red-200 block mb-1">Character limit exceeded</strong>
              Your post contains 302 characters, which exceeds the 280 character limit for your account tier.
            </div>
            <p className="text-zinc-400 text-base leading-relaxed mb-6 line-clamp-3">
              Mortgage rates just hit a 6-month low! If you've been waiting on the sidelines to buy your dream home, now might be the perfect time to start looking again. We're seeing more inventory hitting the market in the Omaha metro area this week than we have all season. Let's chat about your options...
            </p>
            <div className="flex items-center gap-4 text-sm font-medium text-[#A1A1AA] border-t border-[#27272A] pt-4">
              <button className="text-[#F59E0B] hover:text-[#D97706] transition-colors">Edit & Retry</button>
              <button className="hover:text-[#FAFAFA] transition-colors">Dismiss</button>
            </div>
          </article>

          {/* Item 5: Scheduled TikTok */}
          <article className="group bg-[#18181B] border border-[#27272A] rounded-2xl p-6 sm:p-8 hover:border-zinc-700 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[#FAFAFA]">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-[#FAFAFA]">TikTok</div>
                  <div className="text-sm text-[#A1A1AA] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Scheduled for Friday, 5:30 PM
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 text-[#F59E0B] text-xs font-semibold rounded-full border border-amber-500/20">
                Scheduled
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Behind the Scenes</span>
              <span className="px-2.5 py-1 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md">Video</span>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-3 leading-snug">Day in the life of a Realtor 🏡☕️</h3>
                <p className="text-zinc-400 text-base leading-relaxed mb-6">
                  Come with me on a busy Friday! Showings, coffee runs, and negotiating contracts for my amazing clients. #realestate #realtorlife #omaharealestate
                </p>
                <div className="flex items-center gap-4 text-sm font-medium text-[#A1A1AA] border-t border-[#27272A] pt-4">
                  <button className="hover:text-[#FAFAFA] transition-colors">Edit Post</button>
                  <button className="hover:text-[#FAFAFA] transition-colors">Change Time</button>
                </div>
              </div>
              <div className="w-24 h-36 bg-black rounded-xl overflow-hidden flex-shrink-0 relative group-hover:shadow-md transition-shadow border border-zinc-800">
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/40">
                     <Video className="w-4 h-4 ml-0.5" />
                   </div>
                 </div>
                 <div className="absolute bottom-2 left-2 text-[10px] text-white font-medium bg-black/60 px-1.5 py-0.5 rounded">0:45</div>
              </div>
            </div>
          </article>

        </div>
        
        <div className="mt-12 text-center">
          <button className="px-6 py-3 border border-[#27272A] text-[#A1A1AA] font-medium rounded-full hover:bg-[#27272A] hover:text-[#FAFAFA] transition-colors">
            Load More Activity
          </button>
        </div>
      </main>
    </div>
  );
}
