#!/usr/bin/env python3
"""Publish an approved Full Court Buckets draft without a hand-merged conflict.

The article files saved on the pull request stay byte for byte. Shared listing
pages are rebuilt from articles.json: the news hub, the author page, the
homepage (including its ticker), the news sitemaps, the sitemap news list, and
each team page's news section.

Nothing is pushed to main until that rebuild finishes. A failure leaves main
and the live site on the last good version.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

import internal_links as links

SHARED_EXACT = {
    'articles.json',
    'index.html',
    'news/index.html',
    'authors/ryan-moalemi/index.html',
    'pages-sitemap.xml',
    'sitemap.xml',
    'sitemap/index.html',
}
MARKER_OK = 'fcb-publish:published'
MARKER_FAIL = 'fcb-publish:failed'
MARKER_START = 'fcb-publish:start'
TEAM_NEWS_RE = re.compile(r'<section class="section" id="team-news">.*?</section>', re.S)
SITEMAP_NEWS_RE = re.compile(r'<section class="section" id="sitemap-news">.*?</section>', re.S)
TICKER_RE = re.compile(r'<div class="ticker-text">(.*?)</div>', re.S)
START_RE = re.compile(r'^fcb-publish:start\s+([A-Za-z0-9_-]+)\s*$', re.M)


class PublishError(RuntimeError):
    """A publish failure that must not change main."""


def is_shared_listing(path: str) -> bool:
    """True for generated hub, home, sitemap, and team pages. Article HTML is not shared."""
    name = str(path or '').replace('\\', '/').lstrip('./')
    if name in SHARED_EXACT:
        return True
    parts = name.split('/')
    return len(parts) == 4 and parts[0] == 'wnba' and parts[1] == 'teams' and parts[3] == 'index.html'


def merge_article_lists(main_articles: list, pr_articles: list) -> list:
    """Keep every story. The pull request wins when both sides edited the same slug."""
    by_slug = {}
    for article in list(main_articles or []) + list(pr_articles or []):
        if not isinstance(article, dict):
            continue
        slug = str(article.get('slug') or '').strip()
        if not slug:
            continue
        by_slug[slug] = dict(article)
    ordered = []
    seen = set()
    for article in list(pr_articles or []) + list(main_articles or []):
        if not isinstance(article, dict):
            continue
        slug = str(article.get('slug') or '').strip()
        if not slug or slug in seen or slug not in by_slug:
            continue
        seen.add(slug)
        ordered.append(by_slug[slug])
    ordered.sort(key=lambda article: str(article.get('date') or ''), reverse=True)
    return ordered


def article_ticker_inner(html: str) -> str:
    match = TICKER_RE.search(html or '')
    return match.group(1) if match else ''


def apply_homepage_ticker(home_html: str, ticker_inner: str) -> str:
    """Copy the newest article ticker onto the homepage only."""
    if not ticker_inner or '<div class="ticker-text">' not in (home_html or ''):
        return home_html
    return TICKER_RE.sub(
        lambda match: match.group(0)[: match.group(0).find('>') + 1] + ticker_inner + '</div>',
        home_html,
        count=1,
    )


def refresh_team_news(html: str, section: str) -> str:
    text = html or ''
    if TEAM_NEWS_RE.search(text):
        return TEAM_NEWS_RE.sub(section or '', text, count=1)
    if not section:
        return text
    needle = 'href="/wnba/teams/"'
    index = text.find(needle)
    if index == -1:
        return text
    start = text.rfind('<p', 0, index)
    if start == -1:
        return text
    return text[:start] + section + text[start:]


def sitemap_news_section(root: Path, articles: list) -> str:
    items = []
    for article in links._ordered_articles(articles):
        try:
            href = links.article_href(article)
            slug = links.article_slug(article)
        except ValueError:
            continue
        title = str(article.get('title') or slug)
        items.append(f'<li><a href="{links.esc(href)}">{links.esc(title)}</a></li>')
    if (root / 'wnba' / 'couples' / 'index.html').is_file():
        items.append('<li><a href="/wnba/couples/">WNBA Couples</a></li>')
    if not items:
        return ''
    return (
        '<section class="section" id="sitemap-news"><h2>News</h2><ul class="sitemap-list">'
        + ''.join(items)
        + '</ul></section>'
    )


def refresh_sitemap_news(html: str, section: str) -> str:
    if not section or not SITEMAP_NEWS_RE.search(html or ''):
        return html
    return SITEMAP_NEWS_RE.sub(section, html, count=1)


def newest_article_html(root: Path, articles: list) -> str:
    for article in links._ordered_articles(articles):
        try:
            slug = links.article_slug(article)
        except ValueError:
            continue
        path = root / 'news' / slug / 'index.html'
        if path.is_file():
            return path.read_text(encoding='utf-8')
    return ''


def assert_no_conflict_markers(text: str, path: str) -> None:
    if '<<<<<<<' in text or '>>>>>>>' in text:
        raise PublishError(f'{path} still has a merge conflict, so main was not changed.')


def regenerate_listings(root: Path) -> None:
    """Rebuild shared listings. Does not call assemble_news_pages or rewrite article HTML."""
    articles = links.ensure_article_urls(root)
    (root / 'news').mkdir(parents=True, exist_ok=True)
    hub = links.render_news_hub(articles)
    assert_no_conflict_markers(hub, 'news/index.html')
    (root / 'news' / 'index.html').write_text(hub, encoding='utf-8')

    author = links.render_author_page(articles, root)
    assert_no_conflict_markers(author, links.AUTHOR_PAGE)
    author_path = root / links.AUTHOR_PAGE
    author_path.parent.mkdir(parents=True, exist_ok=True)
    author_path.write_text(author, encoding='utf-8')

    home_path = root / 'index.html'
    if home_path.is_file():
        home = links.apply_homepage(home_path.read_text(encoding='utf-8'), articles)
        home = apply_homepage_ticker(home, article_ticker_inner(newest_article_html(root, articles)))
        assert_no_conflict_markers(home, 'index.html')
        home_path.write_text(home, encoding='utf-8')

    for name in ('pages-sitemap.xml', 'sitemap.xml'):
        path = root / name
        if not path.is_file():
            continue
        updated = links.sync_news_sitemap(path.read_text(encoding='utf-8'), articles)
        assert_no_conflict_markers(updated, name)
        path.write_text(updated, encoding='utf-8')

    sitemap_page = root / 'sitemap' / 'index.html'
    if sitemap_page.is_file():
        section = sitemap_news_section(root, articles)
        updated = refresh_sitemap_news(sitemap_page.read_text(encoding='utf-8'), section)
        assert_no_conflict_markers(updated, 'sitemap/index.html')
        sitemap_page.write_text(updated, encoding='utf-8')

    teams = root / 'wnba' / 'teams'
    if teams.is_dir():
        for page in sorted(teams.glob('*/index.html')):
            original = page.read_text(encoding='utf-8')
            updated = refresh_team_news(original, links.team_news_html(root, page.parent.name))
            assert_no_conflict_markers(updated, str(page.relative_to(root)))
            if updated != original:
                page.write_text(updated, encoding='utf-8')


def git(root: Path, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(
        ['git', *args],
        cwd=root,
        text=True,
        capture_output=True,
    )
    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or 'git failed').strip()
        raise PublishError(detail)
    return result


def git_out(root: Path, args: list[str]) -> str:
    return git(root, args).stdout


def ensure_git_identity(root: Path) -> None:
    git(root, ['config', 'user.name', 'Full Court Buckets updater'])
    git(root, ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])


def ref_has(root: Path, ref: str, path: str) -> bool:
    return git(root, ['cat-file', '-e', f'{ref}:{path}'], check=False).returncode == 0


def changed_files(root: Path, main_ref: str) -> list[str]:
    base = git(root, ['merge-base', 'HEAD', main_ref], check=False)
    if base.returncode != 0:
        raise PublishError('The draft does not share history with main, so main was not changed.')
    names = git_out(root, ['diff', '--name-only', '--diff-filter=ACMRT', base.stdout.strip(), 'HEAD'])
    return [name for name in names.splitlines() if name]


def snapshot_protected(root: Path, main_ref: str) -> dict[str, bytes]:
    blobs = {}
    for path in changed_files(root, main_ref):
        if is_shared_listing(path):
            continue
        file = root / path
        if file.is_file():
            blobs[path] = file.read_bytes()
    return blobs


def load_json_list(text: str) -> list:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise PublishError('The article list could not be read, so main was not changed.') from exc
    if not isinstance(data, list):
        raise PublishError('The article list could not be read, so main was not changed.')
    return data


def read_articles(root: Path) -> list:
    path = root / 'articles.json'
    if not path.is_file():
        return []
    return load_json_list(path.read_text(encoding='utf-8'))


def articles_from_ref(root: Path, ref: str) -> list:
    if not ref_has(root, ref, 'articles.json'):
        return []
    return load_json_list(git_out(root, ['show', f'{ref}:articles.json']))


def restore_bytes(root: Path, blobs: dict[str, bytes]) -> None:
    for path, data in blobs.items():
        dest = root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        git(root, ['add', '--', path])


def assert_preserved(root: Path, blobs: dict[str, bytes]) -> None:
    for path, data in blobs.items():
        file = root / path
        if not file.is_file() or file.read_bytes() != data:
            raise PublishError('The article on disk no longer matches the saved draft, so main was not changed.')


def reset_shared_to_main(root: Path, main_ref: str) -> None:
    for path in sorted(SHARED_EXACT):
        if path == 'articles.json':
            continue
        if ref_has(root, main_ref, path):
            git(root, ['checkout', main_ref, '--', path])
    listing = git(root, ['ls-tree', '-r', '--name-only', main_ref, 'wnba/teams'], check=False)
    if listing.returncode != 0:
        return
    for path in listing.stdout.splitlines():
        if path.endswith('/index.html'):
            git(root, ['checkout', main_ref, '--', path])


def unmerged_paths(root: Path) -> list[str]:
    result = git(root, ['diff', '--name-only', '--diff-filter=U'], check=False)
    return [name for name in (result.stdout or '').splitlines() if name]


def resolve_conflicts(root: Path) -> None:
    for path in unmerged_paths(root):
        side = '--theirs' if is_shared_listing(path) else '--ours'
        git(root, ['checkout', side, '--', path])
        git(root, ['add', '--', path])
    if unmerged_paths(root):
        raise PublishError('A merge conflict is still open, so main was not changed.')


def commit_integrated(root: Path, message: str) -> None:
    paths = [
        'articles.json',
        'index.html',
        'news/index.html',
        links.AUTHOR_PAGE,
        'pages-sitemap.xml',
        'sitemap.xml',
        'sitemap/index.html',
        'wnba/teams',
    ]
    existing = [path for path in paths if (root / path).exists() or path == 'wnba/teams']
    if existing:
        git(root, ['add', '--', *existing])
    cached = git(root, ['diff', '--cached', '--quiet'], check=False)
    merging = (root / '.git' / 'MERGE_HEAD').exists()
    if cached.returncode == 0 and not merging:
        return
    git(root, ['commit', '-m', message])


def integrate_branch(root: Path, main_ref: str = 'origin/main') -> None:
    """Merge main, restore article bytes, and regenerate shared listings. Does not push."""
    if main_ref == 'master' or main_ref.endswith('/master'):
        raise PublishError('Refusing to publish the obsolete master branch.')
    ensure_git_identity(root)
    blobs = snapshot_protected(root, main_ref)
    pr_articles = read_articles(root)
    merged = git(root, ['merge', main_ref, '--no-commit', '--no-ff'], check=False)
    if merged.returncode != 0 and not (root / '.git' / 'MERGE_HEAD').exists():
        raise PublishError('Could not merge main into the draft, so main was not changed.')
    resolve_conflicts(root)
    reset_shared_to_main(root, main_ref)
    restore_bytes(root, blobs)
    articles = merge_article_lists(articles_from_ref(root, main_ref), pr_articles)
    article_path = root / 'articles.json'
    article_path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    regenerate_listings(root)
    assert_preserved(root, blobs)
    commit_integrated(root, 'Rebuild shared listings for the approved article')


def push_squash(root: Path, main_ref: str, message: str, remote: str = 'origin') -> str:
    """Squash the rebuilt branch onto main and push. Rejected pushes leave main alone."""
    if main_ref == 'master' or main_ref.endswith('/master'):
        raise PublishError('Refusing to publish the obsolete master branch.')
    ensure_git_identity(root)
    branch = git_out(root, ['rev-parse', '--abbrev-ref', 'HEAD']).strip()
    integrated = git_out(root, ['rev-parse', 'HEAD']).strip()
    git(root, ['checkout', '-B', 'fcb-publish-main', main_ref])
    try:
        squashed = git(root, ['merge', '--squash', integrated], check=False)
        if squashed.returncode != 0:
            raise PublishError('The rebuilt draft could not be squash-merged onto main, so main was not changed.')
        if git(root, ['diff', '--cached', '--quiet'], check=False).returncode == 0:
            return git_out(root, ['rev-parse', 'HEAD']).strip()
        git(root, ['commit', '-m', message])
        pushed = git(root, ['push', remote, 'HEAD:main'], check=False)
        if pushed.returncode != 0:
            raise PublishError('main changed while publishing, so this update was rejected.')
        return git_out(root, ['rev-parse', 'HEAD']).strip()
    finally:
        git(root, ['checkout', branch], check=False)


def gh_json(args: list[str]) -> object:
    result = subprocess.run(['gh', *args], text=True, capture_output=True)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or 'gh failed').strip()
        raise PublishError(detail)
    if not result.stdout.strip():
        return None
    return json.loads(result.stdout)


def post_comment(repo: str, number: str, body: str) -> None:
    gh_json(['api', '--method', 'POST', f'repos/{repo}/issues/{number}/comments', '-f', f'body={body}'])


def remove_label(repo: str, number: str) -> None:
    subprocess.run(
        ['gh', 'api', '--method', 'DELETE', f'repos/{repo}/issues/{number}/labels/approved'],
        text=True,
        capture_output=True,
    )


def latest_start_nonce(repo: str, number: str) -> str:
    payload = gh_json(['api', '--paginate', f'repos/{repo}/issues/{number}/comments'])
    nonce = ''
    if isinstance(payload, list):
        for comment in payload:
            match = START_RE.search(str((comment or {}).get('body') or ''))
            if match:
                nonce = match.group(1)
    return nonce


def pull_request(repo: str, number: str) -> dict:
    payload = gh_json([
        'pr', 'view', str(number), '--repo', repo,
        '--json', 'number,baseRefName,headRefName,state,isDraft,title,mergedAt',
    ])
    return payload if isinstance(payload, dict) else {}


def push_branch(root: Path, branch: str, remote: str = 'origin') -> None:
    pushed = git(root, ['push', remote, f'HEAD:refs/heads/{branch}'], check=False)
    if pushed.returncode != 0:
        raise PublishError('The rebuilt draft could not be saved on its branch, so main was not changed.')


def try_github_squash(number: str) -> bool:
    ready = subprocess.run(['gh', 'pr', 'ready', str(number)], text=True, capture_output=True)
    if ready.returncode != 0 and 'not a draft' not in ((ready.stderr or '') + (ready.stdout or '')).lower():
        pass
    merged = subprocess.run(
        ['gh', 'pr', 'merge', str(number), '--squash'],
        text=True,
        capture_output=True,
    )
    return merged.returncode == 0


def report(repo: str, number: str, nonce: str, ok: bool, message: str) -> None:
    if ok:
        body = f'{MARKER_OK} {nonce}\nPublished. The article was kept as saved, and the news hub, homepage, ticker, and sitemaps were rebuilt.'
    else:
        body = f'{MARKER_FAIL} {nonce}\n{message}'
    try:
        post_comment(repo, number, body)
    except PublishError as exc:
        print(exc, file=sys.stderr)
    remove_label(repo, number)


def publish(root: Path, number: str, branch: str, nonce: str, repo: str, main_ref: str = 'origin/main') -> None:
    info = pull_request(repo, number)
    if str(info.get('baseRefName') or '') != 'main':
        raise PublishError('This pull request does not target main, so it was not published.')
    head = str(info.get('headRefName') or '')
    if branch and head and branch != head:
        raise PublishError('The branch does not match the pull request, so main was not changed.')
    if info.get('mergedAt') or str(info.get('state') or '').upper() == 'MERGED':
        report(repo, number, nonce, True, '')
        return
    if str(info.get('state') or '').upper() == 'CLOSED':
        raise PublishError('The pull request is closed, so main was not changed.')
    use_branch = branch or head
    if not use_branch:
        raise PublishError('The pull request has no branch, so main was not changed.')
    git(root, ['fetch', 'origin', 'main', use_branch])
    git(root, ['checkout', '-B', use_branch, f'origin/{use_branch}'])
    integrate_branch(root, main_ref)
    push_branch(root, use_branch)
    title = str(info.get('title') or 'Publish approved article')
    if not try_github_squash(number):
        push_squash(root, main_ref, title)
        subprocess.run(['gh', 'pr', 'close', str(number), '--comment', f'{MARKER_OK} {nonce}'], text=True, capture_output=True)
    report(repo, number, nonce, True, '')


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Publish an approved Full Court Buckets pull request.')
    parser.add_argument('--pr', default=os.environ.get('PR_NUMBER', ''))
    parser.add_argument('--branch', default=os.environ.get('PR_BRANCH', ''))
    parser.add_argument('--nonce', default=os.environ.get('PUBLISH_NONCE', ''))
    parser.add_argument('--repo', default=os.environ.get('REPO', 'ryanmoalemi/fullcourtbuckets'))
    parser.add_argument('--root', default='.')
    parser.add_argument('--main-ref', default='origin/main')
    args = parser.parse_args(argv)
    number = str(args.pr or '').strip()
    if not number:
        print('A pull request number is required.', file=sys.stderr)
        return 1
    root = Path(args.root).resolve()
    nonce = str(args.nonce or '').strip() or latest_start_nonce(args.repo, number)
    remove_label(args.repo, number)
    try:
        publish(root, number, str(args.branch or '').strip(), nonce, args.repo, args.main_ref)
    except PublishError as exc:
        report(args.repo, number, nonce, False, str(exc))
        print(exc, file=sys.stderr)
        return 1
    except Exception as exc:
        message = 'The shared pages could not be rebuilt, so main was not changed.'
        report(args.repo, number, nonce, False, message)
        print(exc, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
