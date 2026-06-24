import { storage } from "../storage";
import type { Event, EventSource, InsertEvent } from "@shared/schema";
import * as cheerio from 'cheerio';

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  htmlLink?: string;
}

interface ICalEvent {
  uid: string;
  summary?: string;
  description?: string;
  dtstart?: Date;
  dtend?: Date;
  location?: string;
  url?: string;
}

export class EventIngestionService {
  private static instance: EventIngestionService;

  static getInstance(): EventIngestionService {
    if (!this.instance) {
      this.instance = new EventIngestionService();
    }
    return this.instance;
  }

  async syncSource(source: EventSource): Promise<{ added: number; updated: number; errors: string[] }> {
    console.log(`🔄 Syncing event source: ${source.name} (${source.type})`);
    
    try {
      let result: { added: number; updated: number; errors: string[] };
      
      switch (source.type) {
        case 'google_calendar_public':
          result = await this.syncGoogleCalendarPublic(source);
          break;
        case 'ical':
          result = await this.syncICalFeed(source);
          break;
        case 'web_scraper':
          result = await this.syncWebScraper(source);
          break;
        case 'manual':
          result = { added: 0, updated: 0, errors: [] };
          break;
        default:
          result = { added: 0, updated: 0, errors: [`Unknown source type: ${source.type}`] };
      }

      await storage.updateEventSource(source.id, {
        lastSyncAt: new Date(),
        lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
        syncError: result.errors.length > 0 ? result.errors.join('; ') : null,
      });

      console.log(`✅ Synced ${source.name}: ${result.added} added, ${result.updated} updated`);
      return result;
    } catch (error: any) {
      console.error(`❌ Failed to sync ${source.name}:`, error);
      
      await storage.updateEventSource(source.id, {
        lastSyncAt: new Date(),
        lastSyncStatus: 'failed',
        syncError: error.message,
      });

      return { added: 0, updated: 0, errors: [error.message] };
    }
  }

  async syncAllSources(userId: string): Promise<{ 
    sourcesProcessed: number; 
    totalAdded: number; 
    totalUpdated: number; 
    errors: string[] 
  }> {
    const sources = await storage.getEventSources(userId);
    const activeSources = sources.filter(s => s.status === 'active');
    
    let totalAdded = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    for (const source of activeSources) {
      const result = await this.syncSource(source);
      totalAdded += result.added;
      totalUpdated += result.updated;
      errors.push(...result.errors);
    }

    return {
      sourcesProcessed: activeSources.length,
      totalAdded,
      totalUpdated,
      errors,
    };
  }

  private async syncGoogleCalendarPublic(source: EventSource): Promise<{ added: number; updated: number; errors: string[] }> {
    const config = source.config as { calendarId?: string; apiKey?: string };
    
    if (!config?.calendarId) {
      return { added: 0, updated: 0, errors: ['Calendar ID is required for Google Calendar sync'] };
    }

    const apiKey = config.apiKey || process.env.GOOGLE_CALENDAR_API_KEY;
    if (!apiKey) {
      return { added: 0, updated: 0, errors: ['Google Calendar API key not configured'] };
    }

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('timeMin', timeMin);
    url.searchParams.append('timeMax', timeMax);
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');
    url.searchParams.append('maxResults', '100');

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Calendar API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const events: GoogleCalendarEvent[] = data.items || [];
      
      let added = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const gcEvent of events) {
        try {
          const existingEvent = await storage.getEventByExternalId(source.userId, source.id, gcEvent.id);
          
          const eventData: InsertEvent = {
            userId: source.userId,
            sourceId: source.id,
            externalId: gcEvent.id,
            title: gcEvent.summary || 'Untitled Event',
            description: gcEvent.description || null,
            startTime: new Date(gcEvent.start.dateTime || gcEvent.start.date || new Date()),
            endTime: gcEvent.end ? new Date(gcEvent.end.dateTime || gcEvent.end.date || new Date()) : null,
            timezone: gcEvent.start.timeZone || 'America/Chicago',
            location: gcEvent.location || null,
            eventUrl: gcEvent.htmlLink || null,
            isAllDay: !gcEvent.start.dateTime,
            visibility: 'public',
            category: this.categorizeEvent(gcEvent.summary || ''),
            rawData: gcEvent as any,
          };

          if (existingEvent) {
            await storage.updateEvent(existingEvent.id, eventData);
            updated++;
          } else {
            await storage.createEvent(eventData);
            added++;
          }
        } catch (eventError: any) {
          errors.push(`Failed to process event ${gcEvent.id}: ${eventError.message}`);
        }
      }

      return { added, updated, errors };
    } catch (error: any) {
      return { added: 0, updated: 0, errors: [error.message] };
    }
  }

  private async syncICalFeed(source: EventSource): Promise<{ added: number; updated: number; errors: string[] }> {
    const config = source.config as { icalUrl?: string };
    
    if (!config?.icalUrl) {
      return { added: 0, updated: 0, errors: ['iCal URL is required'] };
    }

    try {
      const response = await fetch(config.icalUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch iCal feed (${response.status})`);
      }

      const icalData = await response.text();
      const events = this.parseICalData(icalData);
      
      let added = 0;
      let updated = 0;
      const errors: string[] = [];
      
      const now = new Date();
      const futureEvents = events.filter(e => e.dtstart && e.dtstart > now);

      for (const icalEvent of futureEvents) {
        try {
          if (!icalEvent.uid) continue;
          
          const existingEvent = await storage.getEventByExternalId(source.userId, source.id, icalEvent.uid);
          
          const eventData: InsertEvent = {
            userId: source.userId,
            sourceId: source.id,
            externalId: icalEvent.uid,
            title: icalEvent.summary || 'Untitled Event',
            description: icalEvent.description || null,
            startTime: icalEvent.dtstart || new Date(),
            endTime: icalEvent.dtend || null,
            timezone: 'America/Chicago',
            location: icalEvent.location || null,
            eventUrl: icalEvent.url || null,
            isAllDay: false,
            visibility: 'public',
            category: this.categorizeEvent(icalEvent.summary || ''),
            rawData: icalEvent as any,
          };

          if (existingEvent) {
            await storage.updateEvent(existingEvent.id, eventData);
            updated++;
          } else {
            await storage.createEvent(eventData);
            added++;
          }
        } catch (eventError: any) {
          errors.push(`Failed to process iCal event: ${eventError.message}`);
        }
      }

      return { added, updated, errors };
    } catch (error: any) {
      return { added: 0, updated: 0, errors: [error.message] };
    }
  }

  private parseICalData(data: string): ICalEvent[] {
    const events: ICalEvent[] = [];
    const lines = data.split(/\r?\n/);
    
    let currentEvent: Partial<ICalEvent> | null = null;
    let currentProperty = '';
    let currentValue = '';

    for (const line of lines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        currentValue += line.substring(1);
        continue;
      }

      if (currentEvent && currentProperty) {
        this.processICalProperty(currentEvent, currentProperty, currentValue);
      }

      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = {};
      } else if (line.startsWith('END:VEVENT') && currentEvent) {
        if (currentEvent.uid) {
          events.push(currentEvent as ICalEvent);
        }
        currentEvent = null;
      } else if (currentEvent && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const propertyPart = line.substring(0, colonIndex);
        currentProperty = propertyPart.split(';')[0];
        currentValue = line.substring(colonIndex + 1);
      }
    }

    return events;
  }

  private processICalProperty(event: Partial<ICalEvent>, property: string, value: string): void {
    switch (property.toUpperCase()) {
      case 'UID':
        event.uid = value;
        break;
      case 'SUMMARY':
        event.summary = this.unescapeICalValue(value);
        break;
      case 'DESCRIPTION':
        event.description = this.unescapeICalValue(value);
        break;
      case 'LOCATION':
        event.location = this.unescapeICalValue(value);
        break;
      case 'URL':
        event.url = value;
        break;
      case 'DTSTART':
        event.dtstart = this.parseICalDate(value);
        break;
      case 'DTEND':
        event.dtend = this.parseICalDate(value);
        break;
    }
  }

  private parseICalDate(value: string): Date | undefined {
    if (!value) return undefined;
    
    if (value.length === 8) {
      const year = parseInt(value.substring(0, 4));
      const month = parseInt(value.substring(4, 6)) - 1;
      const day = parseInt(value.substring(6, 8));
      return new Date(year, month, day);
    }
    
    if (value.includes('T')) {
      const cleanValue = value.replace('Z', '');
      const year = parseInt(cleanValue.substring(0, 4));
      const month = parseInt(cleanValue.substring(4, 6)) - 1;
      const day = parseInt(cleanValue.substring(6, 8));
      const hour = parseInt(cleanValue.substring(9, 11)) || 0;
      const minute = parseInt(cleanValue.substring(11, 13)) || 0;
      const second = parseInt(cleanValue.substring(13, 15)) || 0;
      
      if (value.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      }
      return new Date(year, month, day, hour, minute, second);
    }
    
    return new Date(value);
  }

  private unescapeICalValue(value: string): string {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  private categorizeEvent(title: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('open house') || titleLower.includes('home tour') || titleLower.includes('property')) {
      return 'real_estate';
    }
    if (titleLower.includes('market') || titleLower.includes("farmer's") || titleLower.includes('farmers')) {
      return 'market';
    }
    if (titleLower.includes('festival') || titleLower.includes('parade') || titleLower.includes('celebration')) {
      return 'festival';
    }
    if (titleLower.includes('network') || titleLower.includes('mixer') || titleLower.includes('professional')) {
      return 'networking';
    }
    if (titleLower.includes('concert') || titleLower.includes('music') || titleLower.includes('band')) {
      return 'entertainment';
    }
    if (titleLower.includes('sports') || titleLower.includes('game') || titleLower.includes('tournament')) {
      return 'sports';
    }
    if (titleLower.includes('class') || titleLower.includes('workshop') || titleLower.includes('seminar')) {
      return 'education';
    }
    
    return 'community';
  }

  async addManualEvent(userId: string, eventData: {
    title: string;
    description?: string;
    startTime: Date;
    endTime?: Date;
    location?: string;
    category?: string;
  }): Promise<Event> {
    let manualSource = (await storage.getEventSources(userId))
      .find(s => s.type === 'manual');
    
    if (!manualSource) {
      manualSource = await storage.createEventSource({
        userId,
        name: 'Manual Events',
        type: 'manual',
        status: 'active',
      });
    }

    const { nanoid } = await import('nanoid');
    
    return storage.createEvent({
      userId,
      sourceId: manualSource.id,
      externalId: `manual-${nanoid()}`,
      title: eventData.title,
      description: eventData.description || null,
      startTime: eventData.startTime,
      endTime: eventData.endTime || null,
      location: eventData.location || null,
      category: eventData.category || 'community',
      visibility: 'public',
      isAllDay: false,
    });
  }

  private async syncWebScraper(source: EventSource): Promise<{ added: number; updated: number; errors: string[] }> {
    const config = source.config as { scrapeUrl?: string; scraperType?: string };
    
    if (!config?.scrapeUrl) {
      return { added: 0, updated: 0, errors: ['Scrape URL is required'] };
    }

    try {
      const response = await fetch(config.scrapeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NebraskaHomeHub/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch page (${response.status})`);
      }

      const html = await response.text();
      let events: Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> = [];

      // Choose scraper based on scraperType
      switch (config.scraperType) {
        case 'omaha_daily_record':
          events = this.scrapeOmahaDailyRecord(html, config.scrapeUrl);
          break;
        case 'omaha_realtors':
          events = this.scrapeOmahaRealtors(html, config.scrapeUrl);
          break;
        case 'calendar_wiz':
          events = this.scrapeCalendarWiz(html, config.scrapeUrl);
          break;
        case 'eventbrite':
          events = this.scrapeEventbrite(html, config.scrapeUrl);
          break;
        default:
          events = this.scrapeGenericCalendar(html, config.scrapeUrl);
      }

      console.log(`📅 Scraped ${events.length} events from ${source.name}`);

      let added = 0;
      let updated = 0;
      const errors: string[] = [];
      
      const now = new Date();
      const futureEvents = events.filter(e => e.date >= now);

      for (const scrapedEvent of futureEvents) {
        try {
          const externalId = `${config.scraperType || 'scraper'}-${Buffer.from(scrapedEvent.title + scrapedEvent.date.toISOString()).toString('base64').slice(0, 32)}`;
          const existingEvent = await storage.getEventByExternalId(source.userId, source.id, externalId);
          
          const eventData: InsertEvent = {
            userId: source.userId,
            sourceId: source.id,
            externalId,
            title: scrapedEvent.title,
            description: scrapedEvent.description || null,
            startTime: scrapedEvent.date,
            endTime: null,
            timezone: 'America/Chicago',
            location: scrapedEvent.location || null,
            eventUrl: scrapedEvent.url || config.scrapeUrl,
            isAllDay: false,
            visibility: 'public',
            category: 'real_estate',
            tags: ['omaha', 'real_estate'],
            rawData: scrapedEvent as any,
          };

          if (existingEvent) {
            await storage.updateEvent(existingEvent.id, eventData);
            updated++;
          } else {
            await storage.createEvent(eventData);
            added++;
          }
        } catch (eventError: any) {
          errors.push(`Failed to process scraped event: ${eventError.message}`);
        }
      }

      return { added, updated, errors };
    } catch (error: any) {
      return { added: 0, updated: 0, errors: [error.message] };
    }
  }

  private scrapeOmahaDailyRecord(html: string, baseUrl: string): Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> {
    const events: Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> = [];
    const $ = cheerio.load(html);

    // Look for event entries in the calendar
    $('article.event-item, .event-listing, .calendar-event, tr.event, div[class*="event"]').each((_, elem) => {
      try {
        const $elem = $(elem);
        const title = $elem.find('h2, h3, h4, .event-title, .title, a[href*="event"]').first().text().trim();
        const dateText = $elem.find('.event-date, .date, time, [class*="date"]').first().text().trim();
        const location = $elem.find('.event-location, .location, .venue').first().text().trim();
        const description = $elem.find('.event-description, .description, .excerpt').first().text().trim();
        const linkElem = $elem.find('a[href*="event"]').first();
        const url = linkElem.attr('href');

        if (title && dateText) {
          const parsedDate = this.parseFlexibleDate(dateText);
          if (parsedDate) {
            events.push({
              title,
              date: parsedDate,
              location: location || undefined,
              description: description || undefined,
              url: url ? new URL(url, baseUrl).href : undefined,
            });
          }
        }
      } catch (e) { }
    });

    return events;
  }

  private scrapeOmahaRealtors(html: string, baseUrl: string): Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> {
    const events: Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> = [];
    const $ = cheerio.load(html);

    // Omaha Realtors uses divs and specific class structures
    $('.event-item, .social-event, article, .tribe-events-calendar-list__event').each((_, elem) => {
      try {
        const $elem = $(elem);
        const title = $elem.find('h2, h3, .event-title, .tribe-events-calendar-list__event-title').first().text().trim();
        const dateText = $elem.find('.event-date, time, .tribe-events-calendar-list__event-datetime').first().text().trim();
        const location = $elem.find('.event-venue, .location, .tribe-events-calendar-list__event-venue').first().text().trim();
        const description = $elem.find('.event-description, .excerpt').first().text().trim();
        const linkElem = $elem.find('a[href*="event"]').first();
        const url = linkElem.attr('href');

        if (title && dateText) {
          const parsedDate = this.parseFlexibleDate(dateText);
          if (parsedDate) {
            events.push({
              title,
              date: parsedDate,
              location: location || 'Omaha, NE',
              description: description || undefined,
              url: url ? new URL(url, baseUrl).href : undefined,
            });
          }
        }
      } catch (e) { }
    });

    return events;
  }

  private scrapeCalendarWiz(html: string, baseUrl: string): Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> {
    const events: Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> = [];
    const $ = cheerio.load(html);

    // OmahaRealtors CalendarWiz uses list view with day headers followed by event entries
    // Look for day headers like "Monday, December 1st" or "Tuesday, December 2nd"
    const dayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/gi;
    const fullText = $('body').text();
    
    // Find all day headers in the HTML
    let match;
    const dayHeaders: { day: string; month: string; date: number; position: number }[] = [];
    while ((match = dayPattern.exec(fullText)) !== null) {
      dayHeaders.push({
        day: match[1],
        month: match[2],
        date: parseInt(match[3]),
        position: match.index
      });
    }

    // Parse events from structured elements
    // CalendarWiz uses various containers for events
    $('div[class*="cw-"], .event-item, .cal-event, table tr').each((_, elem) => {
      try {
        const $elem = $(elem);
        const text = $elem.text();
        
        // Look for Time: pattern which indicates an event entry
        const timeMatch = text.match(/Time:\s*(\d{1,2}:\d{2}(?:am|pm)?)\s*-\s*(\d{1,2}:\d{2}(?:am|pm)?)/i);
        if (timeMatch) {
          // Find the event title (usually in a bold or heading before Time:)
          const title = $elem.find('b, strong, h3, h4, .event-title').first().text().trim() ||
                       text.split('Time:')[0].replace(/Category.*$/i, '').trim().split('\n').pop()?.trim();
          
          // Find location
          const locationMatch = text.match(/Location(?:\s+Details)?:\s*([^,\n]+(?:,[^,\n]+)?)/i);
          const location = locationMatch ? locationMatch[1].trim() : undefined;
          
          // Find more info URL
          const moreInfoLink = $elem.find('a[href*="zoom"], a[href*="calendly"], a[href*="register"]').first().attr('href');
          
          if (title && title.length > 3) {
            events.push({
              title: title.replace(/^More Info\s*/i, '').trim(),
              date: new Date(), // Will be parsed with day context below
              location: location || 'OABR, Omaha, NE',
              url: moreInfoLink || baseUrl,
            });
          }
        }
      } catch (e) { }
    });

    // Alternative: Parse events by looking for common CalendarWiz event patterns in text
    // Many CalendarWiz sites render as plain text with specific patterns
    const textBlocks = fullText.split(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/i);
    
    for (let i = 1; i < textBlocks.length; i++) {
      const block = textBlocks[i];
      // Extract date from start of block
      const dateMatch = block.match(/^\s*(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
      if (!dateMatch) continue;
      
      const month = dateMatch[1];
      const day = parseInt(dateMatch[2]);
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      
      // Determine year based on month
      const monthNames: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const monthNum = monthNames[month.toLowerCase()];
      if (monthNum === undefined) continue;
      
      // Use next year if month is before current month
      const now = new Date();
      const year = (monthNum < now.getMonth()) ? nextYear : currentYear;
      const eventDate = new Date(year, monthNum, day);
      
      // Find events in this day's block by looking for Time: patterns
      const eventMatches = block.matchAll(/([^\n]+?)\s*Time:\s*(\d{1,2}:\d{2}(?:am|pm)?)\s*-\s*(\d{1,2}:\d{2}(?:am|pm)?)/gi);
      
      for (const eventMatch of eventMatches) {
        const rawTitle = eventMatch[1].replace(/Category.*?(?=\S)/gi, '').trim();
        // Clean up title - remove "More Info" and URLs
        const title = rawTitle
          .replace(/More Info\s*https?:\/\/[^\s]+/gi, '')
          .replace(/https?:\/\/[^\s]+/gi, '')
          .trim()
          .split('\n').pop()?.trim() || '';
        
        const startTime = eventMatch[2];
        
        if (title && title.length > 3 && !title.match(/^(Category|Location|Contact)/i)) {
          // Parse start time
          const timeMatch = startTime.match(/(\d{1,2}):(\d{2})(am|pm)?/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const ampm = timeMatch[3]?.toLowerCase();
            
            if (ampm === 'pm' && hours !== 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            
            eventDate.setHours(hours, minutes, 0, 0);
          }
          
          // Extract location from block
          const locationMatch = block.match(/Location(?:\s+Details)?[:\s]+([^\n]+)/i);
          const location = locationMatch ? locationMatch[1].trim().split(',')[0] : 'OABR, Omaha, NE';
          
          events.push({
            title,
            date: new Date(eventDate),
            location,
            url: baseUrl,
          });
        }
      }
    }

    // Deduplicate events by title
    const seen = new Set<string>();
    return events.filter(e => {
      const key = `${e.title}-${e.date.toDateString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private scrapeEventbrite(html: string, baseUrl: string): Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> {
    const events: Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> = [];
    
    try {
      // Eventbrite embeds JSON-LD structured data in script tags
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
      
      for (const match of jsonLdMatches) {
        try {
          const jsonData = JSON.parse(match[1]);
          
          // Handle array of events or single event
          const items = Array.isArray(jsonData) ? jsonData : [jsonData];
          
          for (const item of items) {
            if (item['@type'] === 'Event' || item['@type'] === 'EventSeries') {
              const title = item.name;
              const startDate = item.startDate ? new Date(item.startDate) : null;
              const location = item.location?.name || item.location?.address?.addressLocality || 'Omaha, NE';
              const description = item.description;
              const url = item.url;
              
              if (title && startDate && !isNaN(startDate.getTime())) {
                events.push({
                  title,
                  date: startDate,
                  location,
                  description: description?.substring(0, 500),
                  url,
                });
              }
            }
          }
        } catch (e) {
          // JSON parse error, continue to next match
        }
      }
      
      // Also try to extract from inline JSON data that Eventbrite uses
      const eventJsonMatch = html.match(/"events":\s*(\[[\s\S]*?\])/);
      if (eventJsonMatch) {
        try {
          const eventsData = JSON.parse(eventJsonMatch[1]);
          for (const evt of eventsData) {
            if (evt.name && evt.start_date) {
              events.push({
                title: evt.name,
                date: new Date(evt.start_date),
                location: evt.venue?.name || 'Omaha, NE',
                url: evt.url || baseUrl,
              });
            }
          }
        } catch (e) { }
      }
      
      // Parse from visible content as fallback
      const $ = cheerio.load(html);
      $('[data-testid="event-card"], .eds-event-card, .search-event-card').each((_, elem) => {
        try {
          const $elem = $(elem);
          const title = $elem.find('[data-testid="event-card-title"], .eds-event-card__formatted-name--is-clamped, h2, h3').first().text().trim();
          const dateText = $elem.find('[data-testid="event-card-date"], .eds-event-card-content__sub-title, time').first().text().trim();
          const locationText = $elem.find('[data-testid="event-card-location"], .card-text--truncated__one').first().text().trim();
          const linkHref = $elem.find('a').first().attr('href');
          
          if (title && dateText) {
            const parsedDate = this.parseFlexibleDate(dateText);
            if (parsedDate) {
              events.push({
                title,
                date: parsedDate,
                location: locationText || 'Omaha, NE',
                url: linkHref ? (linkHref.startsWith('http') ? linkHref : new URL(linkHref, baseUrl).href) : baseUrl,
              });
            }
          }
        } catch (e) { }
      });
    } catch (e) {
      console.error('Eventbrite scraping error:', e);
    }
    
    // Deduplicate
    const seen = new Set<string>();
    return events.filter(e => {
      const key = `${e.title}-${e.date.toDateString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private scrapeGenericCalendar(html: string, baseUrl: string): Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> {
    const events: Array<{ title: string; date: Date; location?: string; description?: string; url?: string }> = [];
    const $ = cheerio.load(html);

    // Generic fallback - look for common event patterns
    $('[class*="event"], article, .listing, tr').each((_, elem) => {
      try {
        const $elem = $(elem);
        const title = $elem.find('h1, h2, h3, h4, .title, a').first().text().trim();
        const dateText = $elem.find('time, [class*="date"], [datetime]').first().text().trim() || 
                        $elem.find('[datetime]').first().attr('datetime');
        
        if (title && dateText) {
          const parsedDate = this.parseFlexibleDate(dateText);
          if (parsedDate) {
            events.push({ title, date: parsedDate });
          }
        }
      } catch (e) { }
    });

    return events;
  }

  private parseFlexibleDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Try standard Date parsing first
    const directParse = new Date(dateStr);
    if (!isNaN(directParse.getTime()) && directParse.getFullYear() >= 2024) {
      return directParse;
    }

    // Try common patterns
    const patterns = [
      /(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i,  // "January 15, 2025" or "January 15"
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,   // "1/15/2025" or "1/15/25"
      /(\d{4})-(\d{2})-(\d{2})/,           // "2025-01-15"
    ];

    const currentYear = new Date().getFullYear();
    
    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        try {
          if (pattern === patterns[0]) {
            const monthNames: Record<string, number> = {
              january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
              july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
              jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            const month = monthNames[match[1].toLowerCase()];
            const day = parseInt(match[2]);
            const year = match[3] ? parseInt(match[3]) : currentYear;
            if (month !== undefined) {
              return new Date(year, month, day);
            }
          } else if (pattern === patterns[1]) {
            let year = parseInt(match[3]);
            if (year < 100) year += 2000;
            return new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
          } else if (pattern === patterns[2]) {
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          }
        } catch (e) { }
      }
    }

    return null;
  }

  getPopularOmahaCalendars(): { name: string; type: string; calendarId?: string; icalUrl?: string; scrapeUrl?: string; scraperType?: string }[] {
    return [
      {
        name: 'US Holidays',
        type: 'google_calendar_public',
        calendarId: 'en.usa#holiday@group.v.calendar.google.com',
      },
      {
        name: 'Omaha City Events',
        type: 'ical',
        icalUrl: 'https://www.visitomaha.com/events/rss/',
      },
      {
        name: 'Omaha Daily Record - Local Real Estate Events',
        type: 'web_scraper',
        scrapeUrl: 'https://omahadailyrecord.com/calendar/local-real-estate-events',
        scraperType: 'omaha_daily_record',
      },
      {
        name: 'Omaha Area Board of Realtors - Social Events',
        type: 'web_scraper',
        scrapeUrl: 'https://www.omaharealtors.com/social-events/',
        scraperType: 'omaha_realtors',
      },
      {
        name: 'OABR Calendar (CalendarWiz)',
        type: 'web_scraper',
        scrapeUrl: 'https://www.calendarwiz.com/calendars/calendar.php?crd=oabr',
        scraperType: 'calendar_wiz',
      },
    ];
  }
}

export const eventIngestionService = EventIngestionService.getInstance();
