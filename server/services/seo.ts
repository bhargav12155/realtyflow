export interface SEOAnalysis {
  score: number;
  issues: string[];
  recommendations: string[];
  keywords: { keyword: string; density: number; rank?: number }[];
}

export interface SiteHealthMetrics {
  loadTime: number;
  mobileScore: number;
  seoScore: number;
  securityScore: number;
  accessibilityScore: number;
}

export class SEOService {
  async analyzeContent(content: string, targetKeywords: string[]): Promise<SEOAnalysis> {
    try {
      const analysis = this.performContentAnalysis(content, targetKeywords);
      return analysis;
    } catch (error) {
      console.error('SEO analysis error:', error);
      throw new Error('Failed to analyze content for SEO');
    }
  }

  async checkKeywordRankings(keywords: string[], domain: string): Promise<{ keyword: string; rank: number | null }[]> {
    try {
      // In a real implementation, this would integrate with SEO APIs like SEMrush, Ahrefs, or SerpAPI
      console.log('Checking rankings for keywords:', keywords, 'domain:', domain);
      
      return keywords.map(keyword => ({
        keyword,
        rank: Math.floor(Math.random() * 100) + 1, // Mock ranking
      }));
    } catch (error) {
      console.error('Keyword ranking check error:', error);
      throw new Error('Failed to check keyword rankings');
    }
  }

  async getSiteHealth(url: string): Promise<SiteHealthMetrics> {
    try {
      // In a real implementation, this would integrate with PageSpeed Insights API, Lighthouse, etc.
      console.log('Checking site health for:', url);
      
      return {
        loadTime: Math.random() * 2 + 1, // 1-3 seconds
        mobileScore: Math.floor(Math.random() * 10) + 90, // 90-100
        seoScore: Math.floor(Math.random() * 10) + 85, // 85-95
        securityScore: Math.floor(Math.random() * 5) + 95, // 95-100
        accessibilityScore: Math.floor(Math.random() * 15) + 85, // 85-100
      };
    } catch (error) {
      console.error('Site health check error:', error);
      throw new Error('Failed to check site health');
    }
  }

  async suggestContentTopics(neighborhood?: string): Promise<string[]> {
    const baseTopics = [
      'First-time home buyer guide',
      'Luxury home features that matter',
      'Understanding the mortgage process',
      'Home staging tips for quick sales',
      'Market trends and predictions',
      'Investment property opportunities',
    ];

    const neighborhoodTopics = neighborhood ? [
      `${neighborhood} neighborhood guide`,
      `Best restaurants in ${neighborhood}`,
      `${neighborhood} school district overview`,
      `Parks and recreation in ${neighborhood}`,
      `${neighborhood} real estate market analysis`,
    ] : [];

    return [...baseTopics, ...neighborhoodTopics];
  }

  private performContentAnalysis(content: string, targetKeywords: string[]): SEOAnalysis {
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    
    let score = 60; // Base score
    const issues: string[] = [];
    const recommendations: string[] = [];
    const keywords: { keyword: string; density: number; rank?: number }[] = [];

    // Analyze keyword density
    targetKeywords.forEach(keyword => {
      const keywordOccurrences = (content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      const density = (keywordOccurrences / wordCount) * 100;
      
      keywords.push({ keyword, density });

      if (density < 0.5) {
        issues.push(`Low keyword density for "${keyword}" (${density.toFixed(1)}%)`);
        recommendations.push(`Increase usage of "${keyword}" to 1-2% density`);
      } else if (density > 3) {
        issues.push(`Keyword stuffing detected for "${keyword}" (${density.toFixed(1)}%)`);
        recommendations.push(`Reduce usage of "${keyword}" to avoid over-optimization`);
        score -= 10;
      } else {
        score += 5;
      }
    });

    // Content length analysis
    if (wordCount < 300) {
      issues.push('Content too short for SEO optimization');
      recommendations.push('Expand content to at least 800 words for better SEO performance');
      score -= 15;
    } else if (wordCount > 2000) {
      score += 10;
    }

    // Check for headings (simple heuristic)
    const hasHeadings = content.includes('#') || content.includes('<h');
    if (!hasHeadings) {
      issues.push('No headings detected');
      recommendations.push('Add H1, H2, and H3 headings to structure content');
      score -= 10;
    } else {
      score += 5;
    }

    // Check for local terms
    const localTerms = ['omaha', 'nebraska', 'neighborhood', 'local', 'community'];
    const hasLocalTerms = localTerms.some(term => content.toLowerCase().includes(term));
    if (hasLocalTerms) {
      score += 10;
    } else {
      recommendations.push('Include local Omaha references for better local SEO');
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      issues,
      recommendations,
      keywords,
    };
  }
}

export const seoService = new SEOService();
