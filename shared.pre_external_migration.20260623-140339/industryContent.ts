export interface ContentStarter {
  postTypeId: string;
  label: string;
  template: string;
}

export interface IndustryContent {
  hashtags: string[];
  contentStarters: ContentStarter[];
  suggestedTopics: string[];
  defaultStyle: string;
}

export const INDUSTRY_CONTENT: Record<string, IndustryContent> = {
  real_estate: {
    hashtags: [
      "#JustListed", "#OpenHouse", "#DreamHome", "#RealEstate", "#HomesForSale",
      "#NewListing", "#HouseHunting", "#Realtor", "#HomeOwnership", "#CurbAppeal",
      "#JustSold", "#MillionDollarListing", "#FirstTimeHomeBuyer", "#LuxuryHomes", "#PropertyTour"
    ],
    contentStarters: [
      { postTypeId: "open_houses", label: "Open House Invite", template: "You're invited! Join us this [day] from [time] at [address] for an open house. Come see this beautiful [beds]bd/[baths]ba home in [neighborhood]." },
      { postTypeId: "open_houses", label: "Weekend Open House", template: "This weekend only! Tour this gorgeous home at [address]. Features include [feature 1], [feature 2], and a spacious backyard. See you there!" },
      { postTypeId: "open_houses", label: "Open House Reminder", template: "Don't forget — open house TODAY at [address] from [time]! Come explore this [beds]bd/[baths]ba gem in [neighborhood]. Refreshments provided!" },
      { postTypeId: "just_listed", label: "Just Listed", template: "Exciting new listing at [address]! This [beds]bd/[baths]ba home features [key feature] and is priced at $[price]. Schedule your private showing today!" },
      { postTypeId: "just_listed", label: "New on Market", template: "Welcome to [address]! This stunning [property type] offers [sqft] sq ft of living space with [highlight]. Don't miss this opportunity — contact me for details!" },
      { postTypeId: "just_listed", label: "Hot New Listing", template: "Just hit the market! [address] — [beds] beds, [baths] baths, $[price]. This one won't last long. DM me to schedule a showing!" },
      { postTypeId: "just_sold", label: "Just Sold", template: "SOLD! Congratulations to the new owners of [address]! Another happy family in their dream home. Thinking of buying or selling? Let's chat!" },
      { postTypeId: "just_sold", label: "Closed Deal", template: "Another successful closing! [address] is officially off the market. If you're ready to make your move, I'm here to help." },
      { postTypeId: "just_sold", label: "Sold Above Asking", template: "SOLD above asking price! [address] closed at $[price]. In this market, having the right agent makes all the difference. Let me help you win!" },
      { postTypeId: "price_improvement", label: "Price Reduced", template: "Price improvement! [address] is now available at $[new price] — that's $[savings] off! This [beds]bd/[baths]ba won't last long at this price." },
      { postTypeId: "price_improvement", label: "New Price Alert", template: "Great news for buyers! [address] just had a price adjustment to $[new price]. This is your chance to get an incredible home at a great value." },
      { postTypeId: "price_improvement", label: "Price Drop", template: "Price just dropped on [address]! Now listed at $[new price]. [beds] beds, [baths] baths, [sqft] sq ft. Contact me before it's gone!" },
      { postTypeId: "e_card", label: "Holiday Greeting", template: "Wishing you and your family a wonderful [holiday]! May your home be filled with warmth, love, and laughter. From your trusted real estate partner." },
      { postTypeId: "e_card", label: "Thank You Card", template: "Thank you for trusting me with your real estate journey! It's been a pleasure working with you. Here's to new beginnings at [address]!" },
      { postTypeId: "e_card", label: "Anniversary Card", template: "Happy home anniversary! It's been [number] year(s) since you moved into [address]. I hope you're loving every moment. Cheers to many more!" },
    ],
    suggestedTopics: [
      "New listings in your area",
      "Home buying tips for first-time buyers",
      "Market trends and price updates",
      "Neighborhood spotlight",
      "Home staging tips",
      "Mortgage rate updates",
    ],
    defaultStyle: "Professional",
  },
  restaurant: {
    hashtags: [
      "#DailySpecial", "#Foodie", "#LocalEats", "#FoodLovers", "#DineLocal",
      "#ChefSpecial", "#FreshIngredients", "#FarmToTable", "#HappyHour", "#BrunchVibes",
      "#FoodPhotography", "#RestaurantLife", "#TasteOfTheDay", "#WeekendDining", "#SupportLocalFood"
    ],
    contentStarters: [
      { postTypeId: "daily_special", label: "Today's Special", template: "Today's special: [dish name]! Made with [fresh ingredients], this [cuisine type] dish is available for a limited time. Stop by and taste the magic!" },
      { postTypeId: "daily_special", label: "Chef's Pick", template: "Chef's pick of the day: [dish name] — [brief description]. Pair it with our [drink recommendation] for the perfect meal. Available today only!" },
      { postTypeId: "daily_special", label: "Lunch Special", template: "Lunch special alert! Enjoy [dish name] for just $[price] today. Fresh, flavorful, and ready in minutes. See you at noon!" },
      { postTypeId: "new_menu_item", label: "New Dish Alert", template: "Introducing our newest creation: [dish name]! [Description of flavors and ingredients]. Available starting [date]. Be the first to try it!" },
      { postTypeId: "new_menu_item", label: "Menu Addition", template: "We're thrilled to add [dish name] to our menu! This [cuisine] delight features [key ingredients] and is perfect for [occasion]. Come taste it!" },
      { postTypeId: "new_menu_item", label: "Seasonal Addition", template: "New on the menu for [season]: [dish name]! Made with seasonal [ingredients], this dish captures the essence of the season. Try it today!" },
      { postTypeId: "happy_hour", label: "Happy Hour", template: "It's happy hour! Join us [days] from [start time]-[end time] for [deal details]. Great drinks, great food, great company. See you at the bar!" },
      { postTypeId: "happy_hour", label: "Drink Specials", template: "Happy hour starts NOW! $[price] [drink type], [appetizer deal], and good vibes until [end time]. Bring a friend and double the fun!" },
      { postTypeId: "happy_hour", label: "After Work Special", template: "Unwind after work with our happy hour deals! [Deal details] every [days] from [time]. The perfect way to end your day." },
      { postTypeId: "weekend_event", label: "Weekend Event", template: "This weekend at [restaurant name]: [event description]! Live [music/entertainment], special menu items, and an unforgettable atmosphere. Reserve your table!" },
      { postTypeId: "weekend_event", label: "Live Music Night", template: "Live music this [day]! Join us for [performer/genre] starting at [time]. Enjoy great food, drinks, and entertainment. No cover charge!" },
      { postTypeId: "weekend_event", label: "Brunch Event", template: "Weekend brunch is back! Join us [day] from [time] for bottomless [drinks] and our famous [dish]. Reservations recommended!" },
      { postTypeId: "customer_review", label: "Guest Love", template: "We love hearing from our guests! '[customer quote]' — Thank you for the kind words. Come see why our community keeps coming back!" },
      { postTypeId: "customer_review", label: "5-Star Review", template: "Another 5-star review! '[review excerpt]' — Reviews like these make it all worth it. Thank you for your support!" },
      { postTypeId: "customer_review", label: "Fan Favorite", template: "Our guests have spoken — [dish name] is the #1 fan favorite this month! Have you tried it yet? Join the club!" },
    ],
    suggestedTopics: [
      "Seasonal menu highlights",
      "Behind-the-scenes kitchen tour",
      "Meet the chef",
      "Weekend brunch specials",
      "Wine pairing recommendations",
      "Customer favorite dishes",
    ],
    defaultStyle: "Funny",
  },
  home_services: {
    hashtags: [
      "#HomeImprovement", "#HomeRepair", "#Handyman", "#Renovation", "#DIYTips",
      "#HomeServices", "#Contractor", "#Plumbing", "#HVAC", "#Roofing",
      "#Landscaping", "#BeforeAndAfter", "#HomeMaintenance", "#FreeEstimate", "#LocalContractor"
    ],
    contentStarters: [
      { postTypeId: "before_after", label: "Before & After", template: "What a transformation! Check out this [project type] we just completed at [location]. Swipe to see the before and after. Ready for your own upgrade?" },
      { postTypeId: "before_after", label: "Project Reveal", template: "From outdated to outstanding! This [room/area] renovation took [timeframe] and the results speak for themselves. Contact us for your free estimate!" },
      { postTypeId: "before_after", label: "Dramatic Makeover", template: "You won't believe this is the same [room/space]! Our team turned a dated [area] into a modern masterpiece. Swipe to see the transformation!" },
      { postTypeId: "seasonal_deal", label: "Seasonal Offer", template: "[Season] is here and so are our deals! Get [discount]% off all [service type] services this month. Book now before spots fill up!" },
      { postTypeId: "seasonal_deal", label: "Limited Time Deal", template: "Limited time offer: [deal details]! Perfect timing to get your home ready for [season]. Call us today at [phone] to schedule." },
      { postTypeId: "seasonal_deal", label: "Early Bird Special", template: "Book your [season] [service type] early and save [discount]%! Our calendar fills up fast. Lock in your spot and your savings today!" },
      { postTypeId: "free_estimate", label: "Free Estimate", template: "Need [service type] work done? We offer FREE estimates with no obligation. Our licensed team has [years] years of experience. Call [phone] today!" },
      { postTypeId: "free_estimate", label: "Get a Quote", template: "Thinking about [project type]? Get a free, no-obligation quote from our expert team. We'll come to you! Call [phone] or message us." },
      { postTypeId: "free_estimate", label: "Free Inspection", template: "Not sure about the condition of your [system/area]? We offer FREE inspections! Catch small problems before they become big ones. Book today!" },
      { postTypeId: "customer_spotlight", label: "Happy Customer", template: "Another happy customer! [Customer name] says: '[testimonial]'. We take pride in every project. See what we can do for your home!" },
      { postTypeId: "customer_spotlight", label: "5-Star Review", template: "We're honored! '[review excerpt]' — Thank you for trusting us with your home. Your satisfaction is our top priority!" },
      { postTypeId: "customer_spotlight", label: "Customer Story", template: "[Customer name] needed [service] fast. We were there same-day and got the job done right. Read their story and see why homeowners trust us!" },
      { postTypeId: "pro_tip", label: "Pro Tip", template: "Pro tip: [maintenance tip]. This simple step can save you [benefit] and prevent costly repairs down the road. Questions? We're always here to help!" },
      { postTypeId: "pro_tip", label: "DIY Advice", template: "DIY weekend tip: [simple task description]. This quick fix takes just [time] and can save you $[amount]. Need help with bigger jobs? Call us!" },
      { postTypeId: "pro_tip", label: "Seasonal Reminder", template: "Seasonal reminder: Don't forget to [maintenance task] before [season]! This prevents [problem] and keeps your home running smoothly." },
    ],
    suggestedTopics: [
      "Seasonal home maintenance checklist",
      "Energy-saving home upgrades",
      "Common home repair mistakes to avoid",
      "How to choose the right contractor",
      "Emergency repair tips",
      "Home improvement ROI",
    ],
    defaultStyle: "Professional",
  },
  retail: {
    hashtags: [
      "#NewArrivals", "#ShopLocal", "#RetailTherapy", "#SaleAlert", "#TrendingNow",
      "#MustHave", "#Shopping", "#FlashSale", "#LimitedEdition", "#CustomerFavorite",
      "#ShopSmall", "#StyleInspo", "#GiftIdeas", "#BestSellers", "#DealOfTheDay"
    ],
    contentStarters: [
      { postTypeId: "new_arrival", label: "New Arrival", template: "Just in! Meet our newest arrival: [product name]. [Brief description]. Available now in-store and online. Shop before it's gone!" },
      { postTypeId: "new_arrival", label: "Fresh Stock", template: "Fresh stock alert! We've just received [product category] that you're going to love. [Key features]. Come check them out today!" },
      { postTypeId: "new_arrival", label: "Just Dropped", template: "Just dropped! [product name] is now available. [Why it's special]. Limited quantities — grab yours before they sell out!" },
      { postTypeId: "flash_sale", label: "Flash Sale", template: "FLASH SALE! [Discount]% off all [category] for the next [hours] hours only! Don't miss these incredible savings. Shop now!" },
      { postTypeId: "flash_sale", label: "Weekend Sale", template: "Weekend sale is ON! Save up to [discount]% on [category]. This deal ends [date]. Visit us in-store or shop online at [url]." },
      { postTypeId: "flash_sale", label: "Clearance Event", template: "Clearance event starts NOW! Up to [discount]% off select [category]. These deals won't last — shop in-store or online today!" },
      { postTypeId: "product_spotlight", label: "Product Feature", template: "Product spotlight: [product name]! Here's why our customers love it — [key benefit 1], [key benefit 2], and [key benefit 3]. Grab yours today!" },
      { postTypeId: "product_spotlight", label: "Staff Pick", template: "Staff pick of the week: [product name]! Our team can't stop raving about [feature]. Come see why it's our top recommendation!" },
      { postTypeId: "product_spotlight", label: "Best Seller", template: "Our #1 best seller: [product name]! [What makes it special]. Join thousands of happy customers — get yours today!" },
      { postTypeId: "customer_review", label: "Customer Review", template: "Our customers are loving [product name]! '[review quote]'. Have you tried it yet? Shop now and see what the hype is about!" },
      { postTypeId: "customer_review", label: "Happy Shopper", template: "Love this feedback! '[review quote]' — Thank you for shopping with us. Your satisfaction makes our day!" },
      { postTypeId: "customer_review", label: "Real Review", template: "[Customer] says: '[review quote]'. Real customers, real reviews. Come experience the difference for yourself!" },
      { postTypeId: "weekend_deal", label: "Weekend Special", template: "Weekend special: Buy [quantity], get [deal]! Stock up on your favorites this [day]. In-store and online. Limited time only!" },
      { postTypeId: "weekend_deal", label: "BOGO Deal", template: "Buy one, get one [deal] on all [category] this weekend! Bring a friend and share the savings. Ends [date]!" },
      { postTypeId: "weekend_deal", label: "Saturday Savings", template: "Saturday savings are here! [Deal details] all day long. Plus, free [gift/shipping] on orders over $[amount]. Don't miss out!" },
    ],
    suggestedTopics: [
      "New product arrivals",
      "Seasonal style guide",
      "Customer favorites of the month",
      "Behind-the-scenes at the store",
      "Gift guide for every budget",
      "Trending products this week",
    ],
    defaultStyle: "None",
  },
  professional_services: {
    hashtags: [
      "#ProfessionalServices", "#BusinessTips", "#ExpertAdvice", "#Consulting", "#IndustryInsights",
      "#ClientSuccess", "#BusinessGrowth", "#Leadership", "#Networking", "#ProfessionalDevelopment",
      "#ThoughtLeadership", "#B2B", "#SmallBusiness", "#Entrepreneurship", "#CareerGrowth"
    ],
    contentStarters: [
      { postTypeId: "client_success", label: "Client Win", template: "Client success story: We helped [client/industry] achieve [result] in just [timeframe]. Here's how we did it and what it means for your business." },
      { postTypeId: "client_success", label: "Case Study", template: "Case study: [Client type] came to us with [challenge]. Our team delivered [solution], resulting in [measurable outcome]. Read the full story!" },
      { postTypeId: "client_success", label: "Results That Speak", template: "[Metric]% improvement in [area] for our client [industry]. When you work with experts, results follow. Let's talk about your goals!" },
      { postTypeId: "expert_tip", label: "Expert Tip", template: "Expert tip: [actionable advice]. This simple strategy can help your business [benefit]. Want more insights? Follow us for weekly tips!" },
      { postTypeId: "expert_tip", label: "Industry Insight", template: "Did you know? [industry fact or trend]. Here's what this means for your business and [number] ways to stay ahead of the curve." },
      { postTypeId: "expert_tip", label: "Quick Win", template: "Quick win for your business: [actionable tip]. We've seen this strategy boost [metric] by [percentage]% for our clients. Try it this week!" },
      { postTypeId: "free_consultation", label: "Free Consult", template: "Ready to take your business to the next level? We're offering free [duration]-minute consultations this [month/week]. Book your spot today!" },
      { postTypeId: "free_consultation", label: "Strategy Session", template: "Book a complimentary strategy session! We'll analyze your [area] and provide actionable recommendations — no strings attached. Limited spots available!" },
      { postTypeId: "free_consultation", label: "Discovery Call", template: "Curious how we can help your business? Schedule a free discovery call and learn exactly what's possible. [Number] spots left this week!" },
      { postTypeId: "industry_update", label: "Industry News", template: "Industry update: [news headline]. Here's our take on what this means for [target audience] and how to adapt your strategy accordingly." },
      { postTypeId: "industry_update", label: "Trend Alert", template: "Trend alert: [trend description] is reshaping [industry]. Here are [number] things you need to know to stay competitive this [quarter/year]." },
      { postTypeId: "industry_update", label: "Market Shift", template: "The [industry] landscape is changing. [Brief description of change]. Here's how smart businesses are adapting — and how you can too." },
      { postTypeId: "team_spotlight", label: "Team Member", template: "Meet [name], our [title]! With [years] years of experience in [specialty], [name] is passionate about helping clients [achieve goal]. Say hello!" },
      { postTypeId: "team_spotlight", label: "Employee Feature", template: "Spotlight on [name]! Fun fact: [interesting detail]. [Name] brings [quality] to our team and our clients every day. We're lucky to have them!" },
      { postTypeId: "team_spotlight", label: "New Team Member", template: "Welcome to the team, [name]! [Name] joins us as [title] bringing expertise in [area]. We're excited for what's ahead!" },
    ],
    suggestedTopics: [
      "Industry trends and predictions",
      "Client success stories",
      "Business growth strategies",
      "Thought leadership insights",
      "Team introductions",
      "FAQ answers from experts",
    ],
    defaultStyle: "Professional",
  },
  general: {
    hashtags: [
      "#SmallBusiness", "#LocalBusiness", "#SupportLocal", "#Community", "#BusinessOwner",
      "#Entrepreneur", "#BehindTheScenes", "#CustomerAppreciation", "#GrandOpening", "#NewBusiness",
      "#ShopLocal", "#CommunityFirst", "#BusinessTips", "#MadeWithLove", "#LocallyOwned"
    ],
    contentStarters: [
      { postTypeId: "announcement", label: "Big News", template: "Big announcement! We're excited to share that [news]. This is a huge milestone for us and we couldn't have done it without your support!" },
      { postTypeId: "announcement", label: "Update", template: "Important update: [details]. We're always working to improve your experience. Stay tuned for more exciting news coming soon!" },
      { postTypeId: "announcement", label: "Exciting News", template: "We've been working on something special and can finally share: [news]! Thank you for being part of our journey. More details coming soon!" },
      { postTypeId: "behind_scenes", label: "Behind the Scenes", template: "Ever wonder what goes on behind the scenes? Here's a sneak peek at [activity/process]. We put heart into everything we do!" },
      { postTypeId: "behind_scenes", label: "Day in the Life", template: "A day in the life at [business name]! From [morning activity] to [evening activity], here's how we make the magic happen." },
      { postTypeId: "behind_scenes", label: "How It's Made", template: "How we create [product/service]: [brief process description]. Quality and care go into every step. Come see for yourself!" },
      { postTypeId: "team_spotlight", label: "Meet the Team", template: "Meet [name]! [Name] has been with us for [time] and brings [quality] to our team every day. Say hi next time you visit!" },
      { postTypeId: "team_spotlight", label: "Team Feature", template: "Shout out to [name], our amazing [role]! [Fun fact or accomplishment]. We're grateful to have them on the team!" },
      { postTypeId: "team_spotlight", label: "New Hire Welcome", template: "Please welcome [name] to our team! [Name] brings [skill/experience] and we're thrilled to have them aboard. Stop by and say hello!" },
      { postTypeId: "special_offer", label: "Special Offer", template: "Special offer just for you! [Deal details]. Valid through [date]. Don't miss out — visit us today or shop online!" },
      { postTypeId: "special_offer", label: "Thank You Deal", template: "As a thank you to our amazing customers, we're offering [deal]. You make everything we do worthwhile. Grab this offer before [date]!" },
      { postTypeId: "special_offer", label: "Flash Promo", template: "Flash promo! [Deal details] for the next [hours] hours only. Show this post in-store for your discount. Hurry, limited time!" },
      { postTypeId: "customer_review", label: "Customer Love", template: "We're grateful for customers like you! '[review quote]'. Your support means the world to us. Thank you for choosing [business name]!" },
      { postTypeId: "customer_review", label: "Happy Customer", template: "Making customers happy is what we do! '[review quote]' — Reviews like this keep us going. Come see why people love us!" },
      { postTypeId: "customer_review", label: "Testimonial", template: "[Customer name] says: '[review quote]'. Real feedback from real customers. We're honored by your trust. Thank you!" },
    ],
    suggestedTopics: [
      "Business updates and milestones",
      "Community involvement stories",
      "Team spotlights and culture",
      "Customer appreciation posts",
      "Tips and advice in your field",
      "Holiday and seasonal content",
    ],
    defaultStyle: "None",
  },
};

export function getIndustryContent(businessType: string): IndustryContent {
  return INDUSTRY_CONTENT[businessType] || INDUSTRY_CONTENT.general;
}
