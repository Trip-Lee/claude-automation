#!/usr/bin/env node

/**
 * Validation Script for ServiceNow Test Fixes
 *
 * Tests the new validation strategies against existing test outputs
 * to verify they detect the required content correctly.
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

const TESTS = [
  { id: 'SN-CB-001', criteria: ['Analyzed existing x_cadso_work_campaign dependencies', 'Analyzed security implications'] },
  { id: 'SN-CB-006', criteria: [
    'Analyzed existing x_cadso_work_campaign dependencies',
    'Analyzed security implications',
    'Identified dependencies between steps',
    'Estimated effort accurately'
  ]}
];

async function readArtifact(testId, artifactPattern) {
  const searchDirs = [
    path.join(process.cwd(), 'tools', 'sn-tools', 'ServiceNow-Tools'),
    path.join(process.cwd())
  ];

  for (const dir of searchDirs) {
    try {
      // Try to find files matching pattern
      if (artifactPattern.includes('*')) {
        // Glob pattern - just try common locations
        const patterns = [
          path.join(dir, artifactPattern),
          path.join(dir, 'analysis', path.basename(artifactPattern)),
          path.join(dir, 'implementation-plan', path.basename(artifactPattern))
        ];

        for (const p of patterns) {
          try {
            const content = await fs.readFile(p.replace('*', ''), 'utf-8');
            return content;
          } catch (e) {
            // Try next
          }
        }
      } else {
        const filePath = path.join(dir, artifactPattern);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          console.log(chalk.gray(`    Found: ${filePath} (${content.length} bytes)`));
          return content;
        } catch (e) {
          // Continue searching
        }
      }
    } catch (e) {
      // Continue searching
    }
  }
  console.log(chalk.yellow(`    Warning: Could not find ${artifactPattern}`));
  return null;
}

async function validateStrategy17Security(content) {
  if (!content) return false;

  const hasSecuritySection = content.match(/##?\s*(\d+\.?\s*)?Security/i);
  const hasSecurityKeywords = (
    content.includes('ACL') || content.includes('permission') ||
    content.includes('authorization') || content.includes('authentication') ||
    content.includes('role') || content.toLowerCase().includes('security')
  );
  const hasSecurityTable = content.match(/\|\s*Security\s*\|/i);
  const hasSecuritySubsection = content.match(/###?\s*(\d+\.?\s*)?Security\s*(Constraints?|Considerations?|Issues?|Implications?|Analysis)/i);

  return hasSecuritySection || hasSecuritySubsection || (hasSecurityKeywords && hasSecurityTable);
}

async function validateStrategy18Effort(content) {
  if (!content) return false;

  const hasEffortSection = content.match(/##?\s*(Effort|Estimation|Estimate|Timeline|Duration|Schedule)/i);
  const hasTimeUnits = content.match(/\d+\s*(hours?|hrs?|days?|weeks?|months?)/i);
  const hasCostEstimate = content.match(/\$\d+/);
  const hasResourceEstimate = content.match(/\d+\s*(FTE|developers?|engineers?|people)/i);

  return (hasEffortSection && hasTimeUnits) || (hasTimeUnits && hasCostEstimate) || hasResourceEstimate;
}

async function validateStrategy19Dependencies(content) {
  if (!content) return false;

  const hasDependencySection = content.match(/##?\s*Dependencies/i);
  const hasDependencyList = content.match(/depends on|prerequisite|required before|must be completed/i);
  const hasSequence = content.match(/##?\s*(Sequence|Order|Prerequisites?|Deployment\s*Sequence)/i);
  const hasDependencyDiagram = content.includes('→') && content.match(/Phase|Step/i);

  return hasDependencySection || hasDependencyList || hasSequence || hasDependencyDiagram;
}

async function validateStrategy20Existing(content) {
  if (!content) return false;

  const hasExistingSection = content.match(/##?\s*Existing\s*(System|Components?|Infrastructure|Implementation|Architecture)/i);
  const hasSnToolsOutput = content.match(/```(bash|shell|json)\s*(npm run|{\s*")/);
  const hasCurrentState = content.match(/##?\s*Current\s*(State|Architecture|Implementation|System)/i);
  const hasAnalysisKeywords = content.match(/currently|existing|already in place|as-is/i);

  return hasExistingSection || (hasSnToolsOutput && hasCurrentState) || (hasSnToolsOutput && hasAnalysisKeywords);
}

async function testValidationStrategies() {
  console.log(chalk.cyan.bold('\n🔍 VALIDATION TEST - New Strategies Against Existing Outputs\n'));

  for (const test of TESTS) {
    console.log(chalk.yellow(`\nTesting ${test.id}...`));

    // Get artifact paths based on test ID
    let artifacts = [];
    if (test.id === 'SN-CB-001') {
      artifacts = ['analysis/WorkCampaignBoard_backend_analysis.md'];
    } else if (test.id === 'SN-CB-006') {
      artifacts = [
        'analysis/campaign_budget_tracking_complete_analysis.md',
        'implementation-plan/campaign_budget_tracking_plan.md',
        'architecture/campaign_budget_tracking_architecture.md',
        'testing/campaign_budget_tracking_test_plan.md'
      ];
    }

    for (const criterion of test.criteria) {
      let passed = false;
      let strategy = '';

      // Check each artifact
      for (const artifact of artifacts) {
        const content = await readArtifact(test.id, artifact);

        if (criterion.includes('security') || criterion.includes('Security')) {
          strategy = 'Strategy 17 (Security)';
          if (await validateStrategy17Security(content)) {
            passed = true;
            break;
          }
        }

        if (criterion.includes('effort') || criterion.includes('Estimated')) {
          strategy = 'Strategy 18 (Effort)';
          if (await validateStrategy18Effort(content)) {
            passed = true;
            break;
          }
        }

        if (criterion.includes('dependencies between') || criterion.includes('Identified dependencies')) {
          strategy = 'Strategy 19 (Dependencies)';
          if (await validateStrategy19Dependencies(content)) {
            passed = true;
            break;
          }
        }

        if (criterion.includes('existing') || criterion.includes('Analyzed existing')) {
          strategy = 'Strategy 20 (Existing)';
          if (await validateStrategy20Existing(content)) {
            passed = true;
            break;
          }
        }
      }

      if (passed) {
        console.log(chalk.green(`  ✓ ${criterion}`));
        console.log(chalk.gray(`    Detected by: ${strategy}`));
      } else {
        console.log(chalk.red(`  ✗ ${criterion}`));
        console.log(chalk.gray(`    Strategy: ${strategy} (no matching content found)`));
      }
    }
  }

  console.log(chalk.cyan.bold('\n📊 Summary\n'));
  console.log(chalk.white('The validation strategies have been tested against existing test outputs.'));
  console.log(chalk.white('Results show which criteria would now pass with the new validators.\n'));
}

// Run validation
testValidationStrategies().catch(err => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});
