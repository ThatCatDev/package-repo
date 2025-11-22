#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PACKAGES_DIR = path.join(__dirname, '../packages');

async function searchGitHub(query) {
  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=100`,
    {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getRepoDetails(owner, repo) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getPackageJson(owner, repo) {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
        }
      }
    );

    if (!response.ok) {
      // Try master branch if main doesn't exist
      const masterResponse = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/master/package.json`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
          }
        }
      );

      if (!masterResponse.ok) {
        return null;
      }

      return masterResponse.json();
    }

    return response.json();
  } catch (error) {
    console.warn(`Could not fetch package.json for ${owner}/${repo}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Scanning GitHub for FreeLens extension repositories...');

  // Ensure packages directory exists
  if (!fs.existsSync(PACKAGES_DIR)) {
    fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  }

  // Search for repos containing both "freelens" and "ext" in the name
  const searchResults = await searchGitHub('freelens ext in:name');

  console.log(`Found ${searchResults.total_count} repositories`);

  for (const repo of searchResults.items) {
    const repoName = repo.name.toLowerCase();

    // Only process repos that contain both "freelens" and "ext"
    if (!repoName.includes('freelens') || !repoName.includes('ext')) {
      continue;
    }

    console.log(`Processing: ${repo.full_name}`);

    // Get detailed repo info
    const details = await getRepoDetails(repo.owner.login, repo.name);

    // Try to get package.json
    const packageJson = await getPackageJson(repo.owner.login, repo.name);

    // Create package metadata
    const metadata = {
      name: repo.name,
      fullName: repo.full_name,
      description: details.description || '',
      homepage: details.homepage || details.html_url,
      stars: details.stargazers_count,
      forks: details.forks_count,
      language: details.language,
      createdAt: details.created_at,
      updatedAt: details.updated_at,
      pushedAt: details.pushed_at,
      defaultBranch: details.default_branch,
      topics: details.topics || [],
      license: details.license?.spdx_id || null,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url,
        url: repo.owner.html_url
      },
      repository: {
        url: details.html_url,
        cloneUrl: details.clone_url,
        sshUrl: details.ssh_url
      },
      packageJson: packageJson,
      lastScanned: new Date().toISOString()
    };

    // Write to packages directory
    const filename = `${repo.name}.json`;
    const filepath = path.join(PACKAGES_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));
    console.log(`  ✓ Created ${filename}`);
  }

  // Create an index file with all packages
  const packageFiles = fs.readdirSync(PACKAGES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'index.json');

  const index = packageFiles.map(f => {
    const content = JSON.parse(fs.readFileSync(path.join(PACKAGES_DIR, f), 'utf-8'));
    return {
      name: content.name,
      fullName: content.fullName,
      description: content.description,
      stars: content.stars,
      updatedAt: content.updatedAt
    };
  });

  fs.writeFileSync(
    path.join(PACKAGES_DIR, 'index.json'),
    JSON.stringify(index, null, 2)
  );

  console.log(`\n✓ Scanned ${searchResults.items.length} repositories`);
  console.log(`✓ Created index with ${index.length} packages`);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
