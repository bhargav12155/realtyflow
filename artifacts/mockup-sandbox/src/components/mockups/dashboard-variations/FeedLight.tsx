import { Bot, Share2, Calendar, Video, Search, BarChart3, Bell, Sparkles, Clock, CheckCircle2, XCircle, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';

const SiFacebook = (props: any) => <Facebook {...props} />;
const SiInstagram = (props: any) => <Instagram {...props} />;
const SiLinkedin = (props: any) => <Linkedin {...props} />;
const SiTiktok = (props: any) => <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52V6.8a4.84 4.84 0 01-1-.11z"/></svg>;
const FaXTwitter = (props: any) => <Twitter {...props} />;

export function FeedLight() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-slate-900 font-sans selection:bg-[#D97706] selection:text-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D97706] flex items-center justify-center">
              <span className="text-white font-bold text-sm">GB</span>
            </div>
            <span className="font-serif font-bold text-xl tracking-tight text-slate-900">My Golden Brick LLC</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-500">
            <a href="#" className="text-[#D97706] transition-colors">Dashboard</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Content</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Calendar</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Video</a>
            <a href="#" className="hover:text-slate-900 transition-colors">SEO</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Social</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Analytics</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-slate-900 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="bg-[#D97706] hover:bg-[#B45309] text-white px-4 py-2 rounded-full font-medium text-sm transition-colors flex items-center gap-2 shadow-sm">
              <Sparkles className="w-4 h-4" />
              Generate Content
            </button>
            <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-[720px] mx-auto pt-12 pb-24 px-4 sm:px-6">
        
        {/* Stats Header */}
        <div className="mb-16">
          <h1 className="font-serif text-3xl font-bold mb-8 text-slate-900">Overview</h1>
          <div className="grid grid-cols-4 gap-8">
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-slate-900 mb-1">47</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Leads</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+12.3%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-slate-900 mb-1">128</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Published</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+4.2%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-slate-900 mb-1">4.2</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">SEO Score</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+0.8</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tight text-slate-900 mb-1">2.4K</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Engagement</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+18.5%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Feed */}
        <div className="space-y-8">
          <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
            <h2 className="font-serif text-2xl font-bold text-slate-900">Activity & Schedule</h2>
            <button className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2">
              Filter <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Item 1: Scheduled LinkedIn */}
          <article className="group bg-white border border-[#F1F5F9] rounded-2xl p-6 sm:p-8 hover:shadow-md hover:border-slate-200 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#0A66C2]">
                  <SiLinkedin className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">LinkedIn Network</div>
                  <div className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Scheduled for Tomorrow, 9:00 AM
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-100">
                Scheduled
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Market Update</span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Dundee</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3 leading-snug">Q3 Market Analysis: Dundee Neighborhood Trends</h3>
            <p className="text-slate-600 text-base leading-relaxed mb-6">
              The Dundee real estate market continues to show strong resilience. Average days on market have decreased by 14% compared to last quarter, while median sale prices remain steady...
            </p>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500 border-t border-slate-50 pt-4">
              <button className="hover:text-slate-900 transition-colors">Edit Post</button>
              <button className="hover:text-slate-900 transition-colors">Reschedule</button>
            </div>
          </article>

          {/* Item 2: Delivered Instagram */}
          <article className="group bg-white border border-[#F1F5F9] rounded-2xl p-6 sm:p-8 hover:shadow-md hover:border-slate-200 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-[#E4405F]">
                  <SiInstagram className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Instagram Feed</div>
                  <div className="text-sm text-slate-500 flex items-center gap-1.5">
                    2 hours ago
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Delivered
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Just Listed</span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Video Tour</span>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3 leading-snug">Stunning Modern Farmhouse at 456 Oak Ave</h3>
                <p className="text-slate-600 text-base leading-relaxed mb-6">
                  Just listed this incredible 4 bed, 3.5 bath modern farmhouse! Featuring a chef's kitchen, soaring 12ft ceilings, and a backyard oasis perfect for entertaining. 🏡✨ Drop a comment if you want the link to the full virtual tour!
                </p>
                <div className="flex items-center gap-6 text-sm font-medium text-slate-500 border-t border-slate-50 pt-4">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400"></div> 342 Likes</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div> 28 Comments</span>
                </div>
              </div>
              <div className="w-32 h-40 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 relative group-hover:shadow-md transition-shadow">
                 <img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&q=80" alt="House exterior" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                   <div className="w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-900">
                     <Video className="w-4 h-4 ml-0.5" />
                   </div>
                 </div>
              </div>
            </div>
          </article>

          {/* Item 3: Delivered Facebook */}
          <article className="group bg-white border border-[#F1F5F9] rounded-2xl p-6 sm:p-8 hover:shadow-md hover:border-slate-200 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#1877F2]">
                  <SiFacebook className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Facebook Business Page</div>
                  <div className="text-sm text-slate-500 flex items-center gap-1.5">
                    Yesterday, 4:30 PM
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Delivered
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Open House</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3 leading-snug">Weekend Open House: 123 Maple St</h3>
            <p className="text-slate-600 text-base leading-relaxed mb-6">
              Join us this Saturday from 1-3 PM for an exclusive look at this beautifully renovated historic home in the heart of the city. Light refreshments will be served!
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="h-48 bg-slate-100 rounded-xl overflow-hidden">
                <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80" alt="Living room" className="w-full h-full object-cover" />
              </div>
              <div className="h-48 bg-slate-100 rounded-xl overflow-hidden">
                <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80" alt="Kitchen" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-slate-500 border-t border-slate-50 pt-4">
              <button className="hover:text-slate-900 transition-colors flex items-center gap-2"><BarChart3 className="w-4 h-4" /> View Insights</button>
              <button className="hover:text-slate-900 transition-colors flex items-center gap-2"><Share2 className="w-4 h-4" /> Boost Post</button>
            </div>
          </article>

          {/* Item 4: Failed X/Twitter */}
          <article className="group bg-white border border-[#F1F5F9] rounded-2xl p-6 sm:p-8 hover:shadow-md hover:border-slate-200 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
                  <FaXTwitter className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">X (Twitter)</div>
                  <div className="text-sm text-slate-500 flex items-center gap-1.5">
                    Yesterday, 10:00 AM
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
                <XCircle className="w-4 h-4" /> Failed
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Market Update</span>
            </div>
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl mb-4 border border-red-100">
              <strong className="font-semibold block mb-1">Character limit exceeded</strong>
              Your post contains 302 characters, which exceeds the 280 character limit for your account tier.
            </div>
            <p className="text-slate-600 text-base leading-relaxed mb-6 line-clamp-3">
              Mortgage rates just hit a 6-month low! If you've been waiting on the sidelines to buy your dream home, now might be the perfect time to start looking again. We're seeing more inventory hitting the market in the Omaha metro area this week than we have all season. Let's chat about your options...
            </p>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500 border-t border-slate-50 pt-4">
              <button className="text-[#D97706] hover:text-[#B45309] transition-colors">Edit & Retry</button>
              <button className="hover:text-slate-900 transition-colors">Dismiss</button>
            </div>
          </article>

          {/* Item 5: Scheduled TikTok */}
          <article className="group bg-white border border-[#F1F5F9] rounded-2xl p-6 sm:p-8 hover:shadow-md hover:border-slate-200 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
                  <SiTiktok className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">TikTok</div>
                  <div className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Scheduled for Friday, 5:30 PM
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-100">
                Scheduled
              </span>
            </div>
            <div className="mb-4 flex gap-2">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Behind the Scenes</span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">Video</span>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3 leading-snug">Day in the life of a Realtor 🏡☕️</h3>
                <p className="text-slate-600 text-base leading-relaxed mb-6">
                  Come with me on a busy Friday! Showings, coffee runs, and negotiating contracts for my amazing clients. #realestate #realtorlife #omaharealestate
                </p>
                <div className="flex items-center gap-4 text-sm font-medium text-slate-500 border-t border-slate-50 pt-4">
                  <button className="hover:text-slate-900 transition-colors">Edit Post</button>
                  <button className="hover:text-slate-900 transition-colors">Change Time</button>
                </div>
              </div>
              <div className="w-24 h-36 bg-slate-900 rounded-xl overflow-hidden flex-shrink-0 relative group-hover:shadow-md transition-shadow">
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/40">
                     <Video className="w-4 h-4 ml-0.5" />
                   </div>
                 </div>
                 <div className="absolute bottom-2 left-2 text-[10px] text-white font-medium bg-black/40 px-1.5 py-0.5 rounded">0:45</div>
              </div>
            </div>
          </article>

        </div>
        
        <div className="mt-12 text-center">
          <button className="px-6 py-3 border border-slate-200 text-slate-600 font-medium rounded-full hover:bg-slate-50 hover:text-slate-900 transition-colors">
            Load More Activity
          </button>
        </div>
      </main>
    </div>
  );
}
