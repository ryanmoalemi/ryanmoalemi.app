#!/usr/bin/env python3
"""The approved-draft publisher keeps article bytes and rebuilds shared listings."""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import publish_approved as publish


ARTICLE = '''<!doctype html>
<html><body>
<div class="ticker"><div class="ticker-text">Reese had four steals. Dream 92, Liberty 82.</div></div>
<article><h1>Angel Reese exact headline</h1><p>ARTICLE_BODY_EXACT</p></article>
</body></html>
'''
OLD_ARTICLE = '<!doctype html><html><body><article><p>OLD_ARTICLE_EXACT</p></article></body></html>\n'
REDIRECT = '<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/news/new-story/"></head><body>REDIRECT_EXACT</body></html>\n'
IMAGE = b'PNGEXACT\x00\x01'


def home(ticker: str, title: str) -> str:
    return f'''<!doctype html>
<html><body>
<div class="ticker"><div class="shell"><div class="ticker-label">Now</div><div class="ticker-text">{ticker}</div></div></div>
<main>
<p id="keep-home">HOMEPAGE_SHELL</p>
<section class="feature-grid" id="latest">
<a class="feature feature-link" id="featured-story" href="/news/old-story/"><img class="feature-photo" id="featured-image" src="/old.webp" alt="Old photo"><span class="feature-credit" id="featured-credit">Photo: Old</span></a>
<h1 id="featured-title">{title}</h1>
<p id="featured-dek">Old dek</p>
<div class="meta" id="featured-meta">Old</div>
<div class="story-list" id="older-stories"></div>
</section>
</main>
</body></html>
'''


def articles(title: str, include_new: bool) -> str:
    rows = []
    if include_new:
        rows.append({
            'slug': 'new-story',
            'url': '/news/new-story/',
            'title': 'Angel Reese exact headline',
            'description': 'New dek',
            'category': 'WNBA',
            'date': '2026-10-04',
            'image': '/images/articles/new-story/photo.webp',
            'imageAlt': 'Angel Reese looking up',
            'imageCredit': 'Photo: Test',
            'teams': ['atlanta-dream'],
        })
    rows.append({
        'slug': 'old-story',
        'url': '/news/old-story/',
        'title': title,
        'description': 'Old',
        'category': 'WNBA',
        'date': '2026-09-01',
        'teams': [],
    })
    return json.dumps(rows, indent=2) + '\n'


def sitemap(loc: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{loc}</loc></url>\n'
        '</urlset>\n'
    )


def team_page(story: str) -> str:
    return (
        '<section id="roster"><h2>Roster stays</h2></section>'
        '<section class="section" id="team-news"><p class="eyebrow">News</p><h2>Latest stories</h2>'
        f'<ul class="teammate-list"><li>{story}</li></ul></section>'
        '<p><a class="inline-link" href="/wnba/teams/">All teams</a></p>\n'
    )


def sitemap_page(story: str) -> str:
    return (
        '<section class="section" id="sitemap-teams"><h2>Teams stay</h2></section>'
        '<section class="section" id="sitemap-news"><h2>News</h2>'
        f'<ul class="sitemap-list"><li>{story}</li></ul></section>\n'
    )


class PublishApprovedTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='fcb-publish-'))
        self.root = self.tmp / 'repo'
        self.root.mkdir()
        self.git(['init', '-b', 'main'])
        self.git(['config', 'user.email', 'test@example.com'])
        self.git(['config', 'user.name', 'Test'])
        self.write_tree(branch_title='Old story', ticker='OLD TICKER', hub='OLD HUB', include_new=False)
        self.commit('base')
        self.git(['branch', 'article'])
        self.git(['checkout', 'article'])
        self.write_tree(
            branch_title='Old story retitled on the branch',
            ticker='BRANCH TICKER',
            hub='BRANCH HUB',
            include_new=True,
        )
        (self.root / 'news' / 'new-story').mkdir(parents=True, exist_ok=True)
        (self.root / 'news' / 'new-story' / 'index.html').write_text(ARTICLE, encoding='utf-8')
        (self.root / 'new-story').mkdir(parents=True, exist_ok=True)
        (self.root / 'new-story' / 'index.html').write_text(REDIRECT, encoding='utf-8')
        image = self.root / 'images' / 'articles' / 'new-story' / 'photo.webp'
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(IMAGE)
        self.commit('article')
        self.article_bytes = (self.root / 'news' / 'new-story' / 'index.html').read_bytes()
        self.redirect_bytes = (self.root / 'new-story' / 'index.html').read_bytes()
        self.image_bytes = image.read_bytes()
        self.old_bytes = (self.root / 'news' / 'old-story' / 'index.html').read_bytes()
        self.git(['checkout', 'main'])
        self.write_tree(
            branch_title='Old story retitled on main',
            ticker='MAIN TICKER',
            hub='MAIN HUB',
            include_new=False,
        )
        self.commit('main moves')
        self.main_sha = self.rev_parse('main')
        self.git(['checkout', 'article'])

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def git(self, args, check=True):
        result = subprocess.run(['git', *args], cwd=self.root, text=True, capture_output=True)
        if check and result.returncode != 0:
            raise AssertionError((result.stderr or result.stdout or 'git failed').strip())
        return result

    def commit(self, message):
        self.git(['add', '-A'])
        self.git(['commit', '-m', message])

    def rev_parse(self, ref):
        return self.git(['rev-parse', ref]).stdout.strip()

    def write_tree(self, branch_title, ticker, hub, include_new):
        (self.root / 'articles.json').write_text(articles(branch_title, include_new), encoding='utf-8')
        (self.root / 'index.html').write_text(home(ticker, branch_title), encoding='utf-8')
        news = self.root / 'news'
        news.mkdir(parents=True, exist_ok=True)
        (news / 'index.html').write_text(f'<html><body>{hub}</body></html>\n', encoding='utf-8')
        old = news / 'old-story'
        old.mkdir(parents=True, exist_ok=True)
        (old / 'index.html').write_text(OLD_ARTICLE, encoding='utf-8')
        author = self.root / 'authors' / 'ryan-moalemi'
        author.mkdir(parents=True, exist_ok=True)
        (author / 'index.html').write_text('<html><body>AUTHOR</body></html>\n', encoding='utf-8')
        (self.root / 'pages-sitemap.xml').write_text(sitemap('https://fullcourtbuckets.com/news/old-story/'), encoding='utf-8')
        (self.root / 'sitemap.xml').write_text(sitemap('https://fullcourtbuckets.com/news/old-story/'), encoding='utf-8')
        site = self.root / 'sitemap'
        site.mkdir(parents=True, exist_ok=True)
        (site / 'index.html').write_text(sitemap_page(branch_title), encoding='utf-8')
        team = self.root / 'wnba' / 'teams' / 'atlanta-dream'
        team.mkdir(parents=True, exist_ok=True)
        (team / 'index.html').write_text(team_page(branch_title), encoding='utf-8')

    def test_conflict_keeps_article_and_rebuilds_listings(self):
        publish.integrate_branch(self.root, 'main')
        self.assertEqual(self.rev_parse('main'), self.main_sha)
        article = self.root / 'news' / 'new-story' / 'index.html'
        self.assertEqual(article.read_bytes(), self.article_bytes)
        self.assertIn(b'ARTICLE_BODY_EXACT', article.read_bytes())
        self.assertEqual((self.root / 'new-story' / 'index.html').read_bytes(), self.redirect_bytes)
        self.assertEqual((self.root / 'images' / 'articles' / 'new-story' / 'photo.webp').read_bytes(), self.image_bytes)
        self.assertEqual((self.root / 'news' / 'old-story' / 'index.html').read_bytes(), self.old_bytes)
        saved = json.loads((self.root / 'articles.json').read_text(encoding='utf-8'))
        by_slug = {row['slug']: row for row in saved}
        self.assertEqual(by_slug['old-story']['title'], 'Old story retitled on the branch')
        self.assertEqual(by_slug['new-story']['title'], 'Angel Reese exact headline')
        hub = (self.root / 'news' / 'index.html').read_text(encoding='utf-8')
        home_html = (self.root / 'index.html').read_text(encoding='utf-8')
        author = (self.root / 'authors' / 'ryan-moalemi' / 'index.html').read_text(encoding='utf-8')
        team = (self.root / 'wnba' / 'teams' / 'atlanta-dream' / 'index.html').read_text(encoding='utf-8')
        site = (self.root / 'sitemap' / 'index.html').read_text(encoding='utf-8')
        pages = (self.root / 'pages-sitemap.xml').read_text(encoding='utf-8')
        self.assertIn('Angel Reese exact headline', hub)
        self.assertIn('Angel Reese exact headline', author)
        self.assertIn('Angel Reese exact headline', home_html)
        self.assertIn('Angel Reese looking up', home_html)
        self.assertIn('HOMEPAGE_SHELL', home_html)
        self.assertIn('Reese had four steals. Dream 92, Liberty 82.', home_html)
        self.assertNotIn('ARTICLE_BODY_EXACT', home_html)
        self.assertIn('Roster stays', team)
        self.assertIn('Angel Reese exact headline', team)
        self.assertIn('Teams stay', site)
        self.assertIn('/news/new-story/', site)
        self.assertIn('https://fullcourtbuckets.com/news/new-story/', pages)
        self.assertNotIn('<<<<<<<', hub)
        self.assertNotIn('<<<<<<<', home_html)

    def test_squash_push_keeps_article_on_main(self):
        bare = self.tmp / 'origin.git'
        subprocess.run(['git', 'init', '--bare', '-b', 'main', str(bare)], check=True, capture_output=True)
        self.git(['remote', 'add', 'origin', str(bare)])
        self.git(['push', 'origin', 'main'])
        publish.integrate_branch(self.root, 'main')
        publish.push_squash(self.root, 'origin/main', 'Angel Reese exact headline')
        check = self.tmp / 'check'
        subprocess.run(['git', 'clone', str(bare), str(check)], check=True, capture_output=True)
        article = check / 'news' / 'new-story' / 'index.html'
        self.assertEqual(article.read_bytes(), self.article_bytes)
        self.assertIn('Angel Reese exact headline', (check / 'news' / 'index.html').read_text(encoding='utf-8'))
        self.assertIn('Reese had four steals. Dream 92, Liberty 82.', (check / 'index.html').read_text(encoding='utf-8'))

    def test_preserved_mismatch_does_not_commit(self):
        before = self.rev_parse('article')
        blobs = { 'news/new-story/index.html': self.article_bytes }
        (self.root / 'news' / 'new-story' / 'index.html').write_text('changed\n', encoding='utf-8')
        with self.assertRaises(publish.PublishError):
            publish.assert_preserved(self.root, blobs)
        self.assertEqual(self.rev_parse('article'), before)
        self.assertEqual(self.rev_parse('main'), self.main_sha)


if __name__ == '__main__':
    unittest.main()
