"""Launch the isolated, repeatable Round 2 demo without touching Supabase."""
import argparse
import getpass
import os
from pathlib import Path
import uvicorn
import main
import store
from seed_round_two_local import seed

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default=str(Path(__file__).resolve().parents[1] / 'tmp' / 'round2-preview.db'))
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--ai', action='store_true', help='Enable the configured real AI provider; defaults to transparent rules.')
    args = parser.parse_args()
    if not os.getenv('CREVO_LOCAL_DEMO_PASSWORD'):
        os.environ['CREVO_LOCAL_DEMO_PASSWORD'] = getpass.getpass('Choose a private local demo password (12+ characters): ')
    seed(args.db)
    if not args.ai:
        main.AI_PROVIDER = None
    uvicorn.run(main.app, host='127.0.0.1', port=args.port)
