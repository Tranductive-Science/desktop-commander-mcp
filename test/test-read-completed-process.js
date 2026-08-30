import assert from 'assert';
import { startProcess, readProcessOutput } from '../dist/tools/improved-process-tools.js';

/**
 * Proper test for read_process_output on completed processes
 * 
 * This test should:
 * - FAIL when the bug exists (current behavior)  
 * - PASS when the bug is fixed (desired behavior)
 */
async function testReadCompletedProcessOutput() {
  console.log('Testing read_process_output on completed process...');
  
  // Start echo command with delay, but timeout before echo happens
  const startResult = await startProcess({
    // Cross-platform delay + output using Node
    command: 'node -e "setTimeout(() => console.log(\'SUCCESS MESSAGE\'), 1000)"',
    timeout_ms: 500  // Returns before the output happens
  });
  
  // Extract PID
  const pidMatch = startResult.content[0].text.match(/Process started with PID (\d+)/);
  assert(pidMatch, 'Should get PID from start_process');
  const pid = parseInt(pidMatch[1]);
  
  // Wait for the actual command to complete and output to be available
  let readResult;
  for (let i = 0; i < 20; i++) {
    readResult = await readProcessOutput({ pid, timeout_ms: 500 });
    if (readResult?.content?.[0]?.text?.includes('SUCCESS MESSAGE')) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // ASSERT: Should be able to read from completed process
  assert(!readResult.isError, 
    'Should be able to read from completed process without error');
    
  // ASSERT: Should contain the echo output
  assert(readResult.content[0].text.includes('SUCCESS MESSAGE'), 
    'Should contain the echo output from completed process');
    
  console.log('✅ Successfully read from completed process');
  console.log('✅ Retrieved echo output:', readResult.content[0].text);
}

/**
 * Test immediate completion scenario
 */
async function testImmediateCompletion() {
  console.log('Testing immediate completion...');
  
  const startResult = await startProcess({
    command: 'node -e "console.log(\'IMMEDIATE OUTPUT\')"',
    timeout_ms: 2000
  });
  
  // Extract PID
  const pidMatch = startResult.content[0].text.match(/Process started with PID (\d+)/);
  assert(pidMatch, 'Should get PID from start_process');
  const pid = parseInt(pidMatch[1]);
  
  // Wait for process to complete
  let readResult;
  for (let i = 0; i < 20; i++) {
    readResult = await readProcessOutput({ pid, timeout_ms: 500 });
    if (readResult?.content?.[0]?.text?.includes('IMMEDIATE OUTPUT')) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  assert(!readResult.isError, 
    'Should be able to read from immediately completed process');
    
  assert(readResult.content[0].text.includes('IMMEDIATE OUTPUT'), 
    'Should contain immediate output from completed process');
    
  console.log('✅ Successfully read from immediately completed process');
}

// Run tests
async function runTests() {
  try {
    await testReadCompletedProcessOutput();
    await testImmediateCompletion();
    console.log('\n🎉 All tests passed - read_process_output works on completed processes!');
    return true;
  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
    console.log('\n💡 This indicates the bug still exists:');
    console.log('   read_process_output cannot read from completed processes');
    console.log('   Expected behavior: Should return completion info and final output');
    return false;
  }
}

runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
