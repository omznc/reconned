#!/usr/bin/env python3
"""
Translation Checker Script

This script analyzes the codebase for unused and missing translations in messages/en.json.

USAGE:
    python3 translation_checker.py

It identifies:
1. Unused translation keys in messages/en.json
2. Missing translation keys that are used in code but not defined
3. Potentially used keys (via dynamic string interpolation)
4. Incorrect usage of useTranslations/getTranslations with parameters (should be non-namespaced)

The script scans for translation calls like:
- t("key")
- t.rich("key")
- t.markup("key")
- t.raw("key")
- t(`translations.${section}`) - dynamic template literals

And identifies when useTranslations/getTranslations are called with parameters.

OUTPUT:
- Console summary with key findings
- Detailed report saved to translation_report.txt
"""

import json
import os
import re
from pathlib import Path
from typing import Set, Dict, List, Tuple


def extract_translation_keys(obj: Dict, prefix: str = "") -> Set[str]:
    """Recursively extract all translation keys from a nested dict structure."""
    keys = set()

    for key, value in obj.items():
        current_key = f"{prefix}.{key}" if prefix else key

        if isinstance(value, dict):
            keys.update(extract_translation_keys(value, current_key))
        else:
            keys.add(current_key)

    return keys


def find_translation_usage_in_file(file_path: Path) -> Tuple[Set[str], Set[str], Set[str]]:
    """
    Find translation usage in a single file.
    Returns:
        - Set of definitely used translation keys
        - Set of potentially used translation key prefixes (for template literals)
        - Set of non-namespaced translation function calls
    """
    used_keys = set()
    potentially_used_prefixes = set()
    non_namespaced_calls = set()

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}")
        return used_keys, potentially_used_prefixes, non_namespaced_calls

    # Common false positives to exclude (these are not translation keys)
    false_positives = {
        # File extensions
        '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.css', '.scss', '.html',
        # DOM elements and attributes
        'canvas', 'main', 'a', 'div', 'span', 'input', 'button', 'form', 'table', 'tbody', 'thead', 'tr', 'td', 'th',
        # Events
        'keydown', 'keyup', 'click', 'change', 'submit', 'load', 'error', 'focus', 'blur',
        # Browser/DOM APIs
        'user-agent', 'x-forwarded-for', 'x-real-ip',
        # CSS/framework classes
        'pm:create', 'pm:remove',
        # Date/time locales
        'bs',
        # Device types
        'Mobile', 'Tablet', 'Mac',
        # Hardcoded messages (these should be in translations but are currently hardcoded)
        'Došlo je do greške prilikom izvršavanja akcije.',
        'Kopirano u clipboard.',
        'Link kopiran.',
        'Neispavna lozinka, pokušajte ponovo.',
        'Neuspješno kopiranje linka.',
        'Menadžer je uspješno demotovan u korisniku.',
        'message'  # This is a variable name, not a translation key
    }

    # Find all translation function calls: t("key"), t.rich("key"), etc.
    # More comprehensive pattern to match various translation methods
    translation_patterns = [
        r't\s*\(\s*["\']([^"\']+)["\']',  # t("key")
        r't\.rich\s*\(\s*["\']([^"\']+)["\']',  # t.rich("key", ...)
        r't\.markup\s*\(\s*["\']([^"\']+)["\']',  # t.markup("key", ...)
        r't\.raw\s*\(\s*["\']([^"\']+)["\']',  # t.raw("key", ...)
    ]

    for pattern in translation_patterns:
        matches = re.findall(pattern, content)
        for key in matches:
            # Clean up the key and check if it's a valid translation key
            clean_key = key.strip()
            if (clean_key and
                clean_key not in false_positives and
                '.' in clean_key and
                not clean_key.startswith('.') and
                not clean_key.startswith('/') and
                not clean_key.startswith('..') and
                not '/' in clean_key and  # Exclude file paths
                not clean_key.endswith(('.ts', '.js', '.tsx', '.jsx', '.json')) and  # Exclude file extensions
                re.match(r'^[a-zA-Z][a-zA-Z0-9._]*$', clean_key)):  # Valid key format
                used_keys.add(clean_key)

    # Find template literal translation calls: t(`key.${variable}`)
    # We need to match the function call followed by a template literal
    template_patterns = [
        r't\s*\(\s*`([^`]+)`',  # t(`key`)
        r't\.rich\s*\(\s*`([^`]+)`',  # t.rich(`key`, ...)
        r't\.markup\s*\(\s*`([^`]+)`',  # t.markup(`key`, ...)
        r't\.raw\s*\(\s*`([^`]+)`',  # t.raw(`key`, ...)
    ]

    for pattern in template_patterns:
        matches = re.findall(pattern, content)
        for template in matches:
            # Extract prefixes from template literals like "translations.${section}"
            # We want to mark all keys that start with "translations." as potentially used
            if '${' in template:
                # Split on ${ and take the first part
                prefix = template.split('${')[0]
                prefix = prefix.strip()
                # Only include prefixes that look like translation keys (not file paths, etc.)
                if (prefix and
                    not prefix.startswith('/') and
                    not prefix.startswith('@') and
                    not prefix.startswith('..') and
                    not '/' in prefix and
                    re.match(r'^[a-zA-Z][a-zA-Z0-9_.]*$', prefix)):
                    if prefix.endswith('.'):
                        potentially_used_prefixes.add(prefix[:-1])  # Remove trailing dot
                    else:
                        potentially_used_prefixes.add(prefix)

    # Find non-namespaced calls to useTranslations/getTranslations
    namespaced_functions = ['useTranslations', 'getTranslations']
    for func in namespaced_functions:
        # Pattern to match function calls with parameters
        param_pattern = rf'{func}\s*\(\s*["\']([^"\']+)["\']'
        param_matches = re.findall(param_pattern, content)
        for param in param_matches:
            non_namespaced_calls.add(f"{func}('{param}') in {file_path}")

    return used_keys, potentially_used_prefixes, non_namespaced_calls


def scan_codebase_for_translations(src_dir: Path) -> Tuple[Set[str], Set[str], Set[str]]:
    """Scan the entire codebase for translation usage."""
    all_used_keys = set()
    all_potentially_used_prefixes = set()
    all_non_namespaced_calls = set()

    # File extensions to scan
    extensions = ['.ts', '.tsx', '.js', '.jsx']

    for ext in extensions:
        for file_path in src_dir.rglob(f'*{ext}'):
            # Skip node_modules and generated files
            if 'node_modules' in str(file_path) or 'generated' in str(file_path):
                continue

            used_keys, potentially_used_prefixes, non_namespaced_calls = find_translation_usage_in_file(file_path)
            all_used_keys.update(used_keys)
            all_potentially_used_prefixes.update(potentially_used_prefixes)
            all_non_namespaced_calls.update(non_namespaced_calls)

    return all_used_keys, all_potentially_used_prefixes, all_non_namespaced_calls


def main():
    """Main function to run the translation analysis."""
    script_dir = Path(__file__).parent
    messages_dir = script_dir / 'messages'
    src_dir = script_dir / 'src'
    en_json_path = messages_dir / 'en.json'
    output_file = script_dir / 'translation_report.txt'

    print("🔍 Analyzing translations...\n")

    # Load and parse the English translation file
    try:
        with open(en_json_path, 'r', encoding='utf-8') as f:
            en_translations = json.load(f)
    except Exception as e:
        print(f"❌ Error loading {en_json_path}: {e}")
        return

    # Extract all defined translation keys
    defined_keys = extract_translation_keys(en_translations)
    print(f"📚 Found {len(defined_keys)} defined translation keys in messages/en.json")

    # Scan codebase for translation usage
    print("🔎 Scanning codebase for translation usage...")
    used_keys, potentially_used_prefixes, non_namespaced_calls = scan_codebase_for_translations(src_dir)
    print(f"💻 Found {len(used_keys)} definitely used translation keys")
    print(f"🎯 Found {len(potentially_used_prefixes)} potentially used key prefixes")

    # Find potentially used keys (keys that start with or contain any of the potentially used prefixes)
    potentially_used_keys = set()
    for prefix in potentially_used_prefixes:
        for key in defined_keys:
            if key.startswith(prefix + '.') or ('.' + prefix + '.') in key:
                potentially_used_keys.add(key)

    # Find unused translations (defined but not used or potentially used)
    unused_keys = defined_keys - used_keys - potentially_used_keys

    # Find missing translations (used but not defined)
    missing_keys = used_keys - defined_keys

    # Write detailed report to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("TRANSLATION ANALYSIS REPORT\n")
        f.write("=" * 60 + "\n\n")

        f.write(f"Generated: {script_dir}\n")
        f.write(f"Messages file: {en_json_path}\n")
        f.write(f"Source directory: {src_dir}\n\n")

        f.write("SUMMARY\n")
        f.write("-" * 40 + "\n")
        f.write(f"Defined keys: {len(defined_keys)}\n")
        f.write(f"Definitely used keys: {len(used_keys)}\n")
        f.write(f"Potentially used keys: {len(potentially_used_keys)}\n")
        f.write(f"Unused keys: {len(unused_keys)}\n")
        f.write(f"Missing keys: {len(missing_keys)}\n")
        f.write(f"Potentially used prefixes: {len(potentially_used_prefixes)}\n")
        f.write(f"Non-namespaced calls: {len(non_namespaced_calls)}\n\n")

        if non_namespaced_calls:
            f.write(f"🚨 NON-NAMESPACED TRANSLATION CALLS ({len(non_namespaced_calls)})\n")
            f.write("-" * 40 + "\n")
            f.write("These calls to useTranslations/getTranslations have parameters and should be non-namespaced:\n\n")
            for call in sorted(non_namespaced_calls):
                f.write(f"  • {call}\n")
            f.write("\n")

        if missing_keys:
            f.write(f"❌ MISSING TRANSLATIONS ({len(missing_keys)})\n")
            f.write("-" * 40 + "\n")
            f.write("These keys are used in code but not defined in messages/en.json:\n\n")
            for key in sorted(missing_keys):
                # Try to find where this key is used
                usage_locations = []
                for ext in ['.ts', '.tsx', '.js', '.jsx']:
                    for file_path in src_dir.rglob(f'*{ext}'):
                        if 'node_modules' in str(file_path) or 'generated' in str(file_path):
                            continue
                        try:
                            with open(file_path, 'r', encoding='utf-8') as file:
                                content = file.read()
                                if f't("{key}")' in content or f't.rich("{key}")' in content:
                                    usage_locations.append(str(file_path.relative_to(script_dir)))
                        except:
                            pass

                f.write(f"  • {key}\n")
                if usage_locations:
                    f.write(f"    Used in: {', '.join(usage_locations[:3])}")
                    if len(usage_locations) > 3:
                        f.write(f" (+{len(usage_locations) - 3} more)")
                    f.write("\n")
            f.write("\n")

        if potentially_used_keys:
            f.write(f"🎯 POTENTIALLY USED KEYS ({len(potentially_used_keys)})\n")
            f.write("-" * 40 + "\n")
            f.write("These keys are marked as potentially used due to dynamic translation calls (e.g., t(`translations.${section}`)):\n\n")
            for key in sorted(potentially_used_keys):
                f.write(f"  • {key}\n")
            f.write("\n")

        if unused_keys:
            f.write(f"⚠️ UNUSED TRANSLATIONS ({len(unused_keys)})\n")
            f.write("-" * 40 + "\n")
            f.write("These keys are defined but never used in the codebase:\n\n")
            for key in sorted(unused_keys):
                f.write(f"  • {key}\n")
            f.write("\n")

    # Report results to console (abbreviated)
    print("\n" + "="*60)
    print("📊 ANALYSIS RESULTS")
    print("="*60)

    # Non-namespaced calls
    if non_namespaced_calls:
        print(f"\n🚨 NON-NAMESPACED TRANSLATION CALLS ({len(non_namespaced_calls)})")
        print("-" * 40)
        for call in sorted(non_namespaced_calls):
            print(f"  • {call}")
        print("\nℹ️  These should be non-namespaced calls (no parameters to useTranslations/getTranslations)")
    else:
        print("\n✅ No non-namespaced translation calls found")

    # Missing translations
    if missing_keys:
        print(f"\n❌ MISSING TRANSLATIONS ({len(missing_keys)})")
        print("-" * 40)
        for key in sorted(missing_keys):
            print(f"  • {key}")
        print("\nℹ️  These keys are used in code but not defined in messages/en.json")
    else:
        print("\n✅ No missing translations found")

    # Potentially used translations
    if potentially_used_keys:
        print(f"\n🎯 POTENTIALLY USED TRANSLATIONS ({len(potentially_used_keys)})")
        print("-" * 40)
        print("  These keys are marked as potentially used due to dynamic translation calls")
        print(f"  (e.g., t(`translations.${{section}}`)) found for prefixes: {', '.join(sorted(potentially_used_prefixes))}")

    # Unused translations
    if unused_keys:
        print(f"\n⚠️  UNUSED TRANSLATIONS ({len(unused_keys)})")
        print("-" * 40)
        print(f"  Showing first 20 of {len(unused_keys)} unused keys...")
        for key in sorted(unused_keys)[:20]:
            print(f"  • {key}")

        if len(unused_keys) > 20:
            print(f"  ... and {len(unused_keys) - 20} more")

        print("\nℹ️  These keys are defined but never used in the codebase")
        print("💡 Consider removing them to keep the translation files clean")
    else:
        print("\n✅ No unused translations found")

    # Summary
    print("\n" + "="*60)
    print("📈 SUMMARY")
    print("="*60)
    print(f"Defined keys: {len(defined_keys)}")
    print(f"Definitely used keys: {len(used_keys)}")
    print(f"Potentially used keys: {len(potentially_used_keys)}")
    print(f"Unused keys: {len(unused_keys)}")
    print(f"Missing keys: {len(missing_keys)}")
    print(f"Non-namespaced calls: {len(non_namespaced_calls)}")
    print(f"\n📄 Detailed report saved to: {output_file}")

    if len(missing_keys) == 0 and len(non_namespaced_calls) == 0:
        print("\n🎉 All translations look good!")
    else:
        print("\n🔧 Some issues found. Please review the output above and the detailed report.")


if __name__ == "__main__":
    main()
