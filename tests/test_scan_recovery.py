import copy
import importlib.util
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from providers.base import Destination, ProviderError, FlightOffer, OutboundOffer
from providers.wizzair import WizzAirProvider
from services.scan_recovery import recover_provider_data

spec = importlib.util.spec_from_file_location('scanner_recovery_test', Path(__file__).resolve().parents[1] / '2.Destination.py')
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)


class RecoveryTest(unittest.TestCase):
    def test_provider_failure_does_not_stop_following_provider(self):
        calls = []
        class Broken:
            airline_name = 'Wizz Air'
            def __init__(self, **kwargs): pass
            def scan_month(self, **kwargs):
                raise ProviderError('HTTP 403')
        class Working(Broken):
            airline_name = 'RYANAIR'
            def scan_month(self, **kwargs):
                calls.append(kwargs['month'])
                outbound = OutboundOffer('2026-10-25T10:00', '2026-10-25T12:00', 20, 'EUR')
                return [FlightOffer('RYANAIR', 'BTS', 'London', 'STN', None,
                                    outbound.departure_local, outbound.arrival_local,
                                    20, 'EUR', outbound_offers=(outbound,))], []
        with patch.object(scanner, 'PROVIDER_CLASSES', [Broken, Working]):
            offers, failures, summary = scanner.scan_all_providers(
                {'wizz air': [Destination('London', 'LTN')], 'ryanair': [Destination('London', 'STN')]},
                date(2026, 10, 20), date(2026, 11, 20), 1)
        self.assertEqual(calls, [10, 11])
        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0].airline, 'RYANAIR')
        self.assertEqual(summary['RYANAIR']['status'], 'fresh')
        self.assertEqual(summary['Wizz Air']['status'], 'unavailable')
        self.assertIn('403', failures['Wizz Air'][0].reason)

    def test_recovery_filters_past_flights_and_keeps_original_timestamp(self):
        previous = {'origin_iata': 'BTS', 'scanned_at_utc': '2026-10-10T10:00:00+00:00',
                    'end_date': '2026-11-01', 'summary': {}, 'offers': [
                        {'airline': 'Wizz Air', 'price': 1, 'outbound_offers': [
                            {'departure_local': '2026-10-10T10:00', 'price': 1},
                            {'departure_local': '2026-10-25T10:00', 'price': 30}], 'return_offers': []}]}
        fresh = {'origin_iata': 'BTS', 'start_date': '2026-10-20', 'end_date': '2027-04-17',
                 'scanned_at_utc': '2026-10-20T12:00:00+00:00',
                 'offers': [{'airline': 'RYANAIR', 'return_offers': []}],
                 'summary': {'Wizz Air': {'status': 'unavailable', 'error': '403'}, 'RYANAIR': {'status': 'fresh'}}}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'flight-data.js'
            path.write_text('window.FLIGHT_DATA = ' + json.dumps(previous) + ';')
            result = recover_provider_data(copy.deepcopy(fresh), path)
            self.assertEqual(result['offers'][1]['price'], 30)
            self.assertEqual(len(result['offers'][1]['outbound_offers']), 1)
            self.assertEqual(result['summary']['Wizz Air']['status'], 'stale')
            self.assertEqual(result['summary']['Wizz Air']['scanned_at_utc'], previous['scanned_at_utc'])
            self.assertEqual(result['summary']['Wizz Air']['end_date'], '2026-11-01')
            path.write_text('window.FLIGHT_DATA = ' + json.dumps(result) + ';')
            again = recover_provider_data(copy.deepcopy(fresh), path)
            self.assertEqual(again['summary']['Wizz Air']['scanned_at_utc'], previous['scanned_at_utc'])
            path.write_text('invalid')
            missing = recover_provider_data(copy.deepcopy(fresh), path)
            self.assertEqual(len(missing['offers']), 1)
            self.assertIsNone(missing['summary']['Wizz Air']['scanned_at_utc'])

    def test_wizz_discovers_current_api_from_public_page(self):
        from io import BytesIO
        response = BytesIO(b'config={apiUrl:"https://be.wizzair.com/29.21.0/Api"}')
        with patch('providers.wizzair.urlopen', return_value=response) as request:
            provider = WizzAirProvider()
            self.assertEqual(provider._discover_api_url(), 'https://be.wizzair.com/29.21.0/Api')
            self.assertEqual(provider._discover_api_url(), 'https://be.wizzair.com/29.21.0/Api')
            self.assertEqual(request.call_count, 1)
            self.assertEqual(request.call_args.args[0].full_url, 'https://www.wizzair.com/en-gb')
