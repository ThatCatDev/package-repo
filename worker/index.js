/**
 * Cloudflare Worker for FreeLens Extension Registry
 * Provides an HTTP endpoint for manually registering extensions
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Register endpoint
    if (url.pathname === '/register' && request.method === 'POST') {
      return handleRegister(request, env, corsHeaders);
    }

    // Trigger scan endpoint
    if (url.pathname === '/scan' && request.method === 'POST') {
      return handleScan(request, env, corsHeaders);
    }

    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders
    });
  },
};

async function handleRegister(request, env, corsHeaders) {
  try {
    // Validate API key if configured
    if (env.API_KEY) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${env.API_KEY}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await request.json();
    const { repo } = body;

    if (!repo) {
      return new Response(JSON.stringify({ error: 'Missing repo field. Expected format: owner/repo-name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate repo format
    const repoMatch = repo.match(/^([^/]+)\/(.+)$/);
    if (!repoMatch) {
      return new Response(JSON.stringify({ error: 'Invalid repo format. Expected: owner/repo-name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [, owner, repoName] = repoMatch;

    // Validate repo name contains both "freelens" and "ext"
    const nameLower = repoName.toLowerCase();
    if (!nameLower.includes('freelens') || !nameLower.includes('ext')) {
      return new Response(JSON.stringify({
        error: 'Repository name must contain both "freelens" and "ext"'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the repo exists on GitHub
    const repoCheck = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${env.GITHUB_TOKEN}` } : {})
      }
    });

    if (!repoCheck.ok) {
      return new Response(JSON.stringify({
        error: `Repository ${repo} not found on GitHub`
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trigger the GitHub Actions workflow
    const triggerResponse = await fetch(
      `https://api.github.com/repos/${env.REGISTRY_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'scan-repos',
          client_payload: {
            repo: repo,
            trigger: 'manual'
          }
        })
      }
    );

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text();
      console.error('GitHub trigger error:', errorText);
      return new Response(JSON.stringify({
        error: 'Failed to trigger registry update',
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Extension ${repo} registered successfully. It will appear in the registry within a few minutes.`,
      repo: repo
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in handleRegister:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleScan(request, env, corsHeaders) {
  try {
    // Validate API key if configured
    if (env.API_KEY) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${env.API_KEY}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Trigger a full scan
    const triggerResponse = await fetch(
      `https://api.github.com/repos/${env.REGISTRY_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'scan-repos',
          client_payload: {
            trigger: 'manual-scan'
          }
        })
      }
    );

    if (!triggerResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Failed to trigger scan'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Full scan triggered successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
