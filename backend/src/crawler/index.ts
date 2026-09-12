import { config } from '../config.js';
import { crawlPublicSite as crawlPublicSitePlaywright } from './crawl.js';
import { crawlPublicSiteStatic } from './staticCrawl.js';

export type { CrawledPage } from './crawl.js';

export async function crawlPublicSite(startUrl: string, pageLimit: number) {
  if (config.CRAWLER_ENGINE === 'static') {
    return crawlPublicSiteStatic(startUrl, pageLimit);
  }
  return crawlPublicSitePlaywright(startUrl, pageLimit);
}
