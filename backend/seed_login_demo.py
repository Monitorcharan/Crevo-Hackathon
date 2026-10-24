"""Legacy entry point: sign-in demos now use only isolated local data."""
import argparse
import getpass
import os
from seed_round_two_local import seed

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, help='An isolated local SQLite file')
    args = parser.parse_args()
    if not os.getenv('CREVO_LOCAL_DEMO_PASSWORD'):
        os.environ['CREVO_LOCAL_DEMO_PASSWORD'] = getpass.getpass('Choose a private local demo password (12+ characters): ')
    seed(args.db)
