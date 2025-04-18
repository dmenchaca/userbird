# Firecrawl Embedding Integration

This document explains how to use the backend-only Firecrawl embedding integration for crawling and embedding help documentation.

## Overview

This integration consists of two Netlify Functions:

1. **start-crawl**: Triggers Firecrawl to crawl a specified URL
2. **firecrawl-webhook**: Processes webhook events from Firecrawl, generates embeddings, and stores them in Supabase

No frontend integration is required as this is a backend-only solution.

## Required Environment Variables

Ensure these environment variables are set in your Netlify environment:

- `FIRECRAWL_API_KEY`: Your Firecrawl API key
- `OPENAI_API_KEY`: Your OpenAI API key
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## How to Use

### Triggering a Crawl

Send a POST request to `/.netlify/functions/start-crawl` with the following payload:

```json
{
  "url": "https://example.com/help",
  "form_id": "abc123"  // Optional
}
```

This will start a crawl job on Firecrawl and configure it to send webhook events to the `firecrawl-webhook` function.

### Processing Webhook Events

The `firecrawl-webhook` function automatically:

1. Receives crawl.page events from Firecrawl
2. Splits the markdown content into chunks (~500 tokens each)
3. Generates embeddings using OpenAI
4. Stores the chunks and embeddings in Supabase

### Supabase Schema

The implementation uses a `documents` table with the following schema:

- `id`: UUID (primary key)
- `content`: text (content chunk)
- `embedding`: vector (1536-dim OpenAI embedding)
- `form_id`: text (optional reference to a form)
- `source_url`: text (original URL)
- `title`: text (page title)
- `crawl_timestamp`: timestamptz (when the crawl was done)

## Debugging

Check the Netlify function logs for errors and debugging information.

## Limitations

- Maximum crawl limit: 100 pages
- Content format: Markdown only
- Currently no progress tracking or notifications 