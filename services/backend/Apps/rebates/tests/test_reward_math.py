"""Locked reward math — every example from the Master's Offer Type section."""

from decimal import Decimal as D

from django.test import SimpleTestCase

from Apps.rebates import reward_math as rm


class FreeTests(SimpleTestCase):
    def test_master_examples(self):
        # Verified price $3.49 → $3.49; $6.49 → capped at $5.00.
        self.assertEqual(rm.decide(deal_type=rm.FREE, unit_prices=[D("3.49")], max_rebate="5").amount, D("3.49"))
        self.assertEqual(rm.decide(deal_type=rm.FREE, unit_prices=[D("6.49")], max_rebate="5").amount, D("5.00"))

    def test_one_reward_even_with_several_units(self):
        d = rm.decide(deal_type=rm.FREE, unit_prices=[D("2.00"), D("3.00")], max_rebate="5")
        self.assertEqual(d.amount, D("3.00"))

    def test_no_eligible_unit(self):
        self.assertEqual(rm.decide(deal_type=rm.FREE, unit_prices=[], max_rebate="5").status, rm.NOT_ENOUGH_UNITS)

    def test_unknown_price_goes_to_review_unless_cap_already_reached(self):
        self.assertEqual(rm.decide(deal_type=rm.FREE, unit_prices=[None], max_rebate="5").status, rm.NEEDS_REVIEW)
        d = rm.decide(deal_type=rm.FREE, unit_prices=[None, D("7.00")], max_rebate="5")
        self.assertEqual((d.status, d.amount), (rm.QUALIFIES, D("5.00")))


class BogoFreeTests(SimpleTestCase):
    def test_master_examples(self):
        # $4.49 + $3.99 → $3.99; lower item $6.00 with $5 max → $5.00.
        self.assertEqual(rm.decide(deal_type=rm.BOGO_FREE, unit_prices=[D("4.49"), D("3.99")], max_rebate="5").amount, D("3.99"))
        self.assertEqual(rm.decide(deal_type=rm.BOGO_FREE, unit_prices=[D("7.00"), D("6.00")], max_rebate="5").amount, D("5.00"))

    def test_needs_two_units(self):
        self.assertEqual(rm.decide(deal_type=rm.BOGO_FREE, unit_prices=[D("4.49")], max_rebate="5").status, rm.NOT_ENOUGH_UNITS)

    def test_quantity_two_on_one_line_counts(self):
        # A line "2 x $3.99" arrives as two units.
        self.assertEqual(rm.decide(deal_type=rm.BOGO_FREE, unit_prices=[D("3.99"), D("3.99")], max_rebate="5").amount, D("3.99"))

    def test_best_pair_with_three_units(self):
        d = rm.decide(deal_type=rm.BOGO_FREE, unit_prices=[D("1.00"), D("4.00"), D("3.00")], max_rebate="5")
        self.assertEqual(d.amount, D("3.00"))


class BogoHalfTests(SimpleTestCase):
    def test_master_example_rounds_normally(self):
        # 50% of $3.99 = $1.995 → $2.00.
        self.assertEqual(rm.decide(deal_type=rm.BOGO_HALF, unit_prices=[D("4.49"), D("3.99")], max_rebate="3").amount, D("2.00"))

    def test_capped(self):
        self.assertEqual(rm.decide(deal_type=rm.BOGO_HALF, unit_prices=[D("9.00"), D("8.00")], max_rebate="3").amount, D("3.00"))


class BuyXGetYTests(SimpleTestCase):
    def test_master_example(self):
        # Required 2, fixed $2: one unit doesn't qualify, two or more → $2.
        kw = dict(deal_type=rm.BUY_X_GET_Y, fixed_reward="2", required_quantity=2)
        self.assertEqual(rm.decide(unit_prices=[D("3.00")], **kw).status, rm.NOT_ENOUGH_UNITS)
        self.assertEqual(rm.decide(unit_prices=[D("3.00"), None], **kw).amount, D("2.00"))
        self.assertEqual(rm.decide(unit_prices=[None, None, None], **kw).amount, D("2.00"))

    def test_max_reward_is_fixed_reward(self):
        self.assertEqual(rm.max_reward(rm.BUY_X_GET_Y, max_rebate=None, fixed_reward="2"), D("2.00"))
        self.assertEqual(rm.max_reward(rm.FREE, max_rebate="5", fixed_reward=None), D("5.00"))
