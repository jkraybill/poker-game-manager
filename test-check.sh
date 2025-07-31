#!/bin/bash

# Run each test file and check result
echo "Checking integration tests..."

# Migrated tests
for test in dead-button.test.js dead-button-simple.test.js dead-button-advanced.test.js event-ordering-verified.test.js event-ordering-fixed.test.js button-rotation.test.js; do
  echo -n "Testing $test... "
  if npm test -- packages/core/src/integration/$test 2>&1 | grep -q "Test Files.*1 passed"; then
    echo "✓ PASSED"
  else
    echo "✗ FAILED"
  fi
done

# Other integration tests
for test in betting-reopening-simple.test.js eliminated-player-display.test.js elimination-display-fixed.test.js elimination-ordering.test.js event-ordering-elimination.test.js event-ordering-simple.test.js issue-11-minimal-repro.test.js memory-leak-repro.test.js standings-display.test.js; do
  echo -n "Testing $test... "
  if npm test -- packages/core/src/integration/$test 2>&1 | grep -q "Test Files.*1 passed"; then
    echo "✓ PASSED"
  else
    echo "✗ FAILED"
  fi
done