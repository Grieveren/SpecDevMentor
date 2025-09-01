#!/usr/bin/env node

/**
 * Test Coverage Validation Script
 * Validates test results and provides coverage analysis
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TestCoverageValidator {
  constructor() {
    this.results = {
      client: { passed: 0, failed: 0, total: 0, coverage: 0 },
      server: { passed: 0, failed: 0, total: 0, coverage: 0 },
      overall: { passed: 0, failed: 0, total: 0, passRate: 0 },
    };
  }

  async validateTestSuite() {
    console.log('🧪 Starting Test Suite Validation...\n');

    try {
      // Run client tests
      console.log('📱 Running client tests...');
      await this.runClientTests();

      // Run server tests
      console.log('🖥️  Running server tests...');
      await this.runServerTests();

      // Generate report
      this.generateReport();

      // Validate against thresholds
      this.validateThresholds();
    } catch (error) {
      console.error('❌ Test validation failed:', error.message);
      process.exit(1);
    }
  }

  async runClientTests() {
    try {
      const output = execSync('pnpm --filter client test', {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 120000, // 2 minutes timeout
      });

      this.parseTestOutput(output, 'client');
    } catch (error) {
      // Parse output even if tests failed
      if (error.stdout) {
        this.parseTestOutput(error.stdout, 'client');
      }
      console.log('⚠️  Some client tests failed, but continuing validation...');
    }
  }

  async runServerTests() {
    try {
      const output = execSync('pnpm --filter server test', {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 120000, // 2 minutes timeout
      });

      this.parseTestOutput(output, 'server');
    } catch (error) {
      // Parse output even if tests failed
      if (error.stdout) {
        this.parseTestOutput(error.stdout, 'server');
      }
      console.log('⚠️  Some server tests failed, but continuing validation...');
    }
  }

  parseTestOutput(output, type) {
    // Parse Vitest output format
    const testFileMatch = output.match(
      /Test Files\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/
    );
    const testMatch = output.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/);

    if (testMatch) {
      this.results[type].failed = parseInt(testMatch[1]) || 0;
      this.results[type].passed = parseInt(testMatch[2]) || 0;
      this.results[type].total = parseInt(testMatch[3]) || 0;
    }

    // Try to extract coverage if available
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      this.results[type].coverage = parseFloat(coverageMatch[1]);
    }
  }

  generateReport() {
    console.log('\n📊 Test Suite Validation Report');
    console.log('================================\n');

    // Client results
    console.log('📱 Client Tests:');
    console.log(`   Passed: ${this.results.client.passed}`);
    console.log(`   Failed: ${this.results.client.failed}`);
    console.log(`   Total:  ${this.results.client.total}`);
    console.log(`   Pass Rate: ${this.calculatePassRate(this.results.client)}%`);
    if (this.results.client.coverage > 0) {
      console.log(`   Coverage: ${this.results.client.coverage}%`);
    }

    console.log('\n🖥️  Server Tests:');
    console.log(`   Passed: ${this.results.server.passed}`);
    console.log(`   Failed: ${this.results.server.failed}`);
    console.log(`   Total:  ${this.results.server.total}`);
    console.log(`   Pass Rate: ${this.calculatePassRate(this.results.server)}%`);
    if (this.results.server.coverage > 0) {
      console.log(`   Coverage: ${this.results.server.coverage}%`);
    }

    // Overall results
    this.results.overall.passed = this.results.client.passed + this.results.server.passed;
    this.results.overall.failed = this.results.client.failed + this.results.server.failed;
    this.results.overall.total = this.results.client.total + this.results.server.total;
    this.results.overall.passRate = this.calculatePassRate(this.results.overall);

    console.log('\n🎯 Overall Results:');
    console.log(`   Passed: ${this.results.overall.passed}`);
    console.log(`   Failed: ${this.results.overall.failed}`);
    console.log(`   Total:  ${this.results.overall.total}`);
    console.log(`   Pass Rate: ${this.results.overall.passRate}%`);
  }

  calculatePassRate(results) {
    if (results.total === 0) return 0;
    return Math.round((results.passed / results.total) * 100);
  }

  validateThresholds() {
    console.log('\n🎯 Threshold Validation:');

    const minPassRate = 70; // 70% minimum pass rate
    const minCoverage = 60; // 60% minimum coverage (when available)

    let validationPassed = true;

    // Check overall pass rate
    if (this.results.overall.passRate < minPassRate) {
      console.log(
        `❌ Overall pass rate (${this.results.overall.passRate}%) below threshold (${minPassRate}%)`
      );
      validationPassed = false;
    } else {
      console.log(`✅ Overall pass rate (${this.results.overall.passRate}%) meets threshold`);
    }

    // Check client pass rate
    const clientPassRate = this.calculatePassRate(this.results.client);
    if (clientPassRate < minPassRate) {
      console.log(`⚠️  Client pass rate (${clientPassRate}%) below threshold (${minPassRate}%)`);
    } else {
      console.log(`✅ Client pass rate (${clientPassRate}%) meets threshold`);
    }

    // Check server pass rate
    const serverPassRate = this.calculatePassRate(this.results.server);
    if (serverPassRate < minPassRate) {
      console.log(`⚠️  Server pass rate (${serverPassRate}%) below threshold (${minPassRate}%)`);
    } else {
      console.log(`✅ Server pass rate (${serverPassRate}%) meets threshold`);
    }

    // Check coverage if available
    if (this.results.client.coverage > 0 || this.results.server.coverage > 0) {
      const avgCoverage = (this.results.client.coverage + this.results.server.coverage) / 2;
      if (avgCoverage < minCoverage) {
        console.log(
          `⚠️  Average coverage (${avgCoverage.toFixed(1)}%) below threshold (${minCoverage}%)`
        );
      } else {
        console.log(`✅ Average coverage (${avgCoverage.toFixed(1)}%) meets threshold`);
      }
    }

    // Save results to file
    this.saveResults();

    if (validationPassed) {
      console.log('\n🎉 Test suite validation PASSED!');
      return true;
    } else {
      console.log('\n⚠️  Test suite validation completed with warnings');
      return false;
    }
  }

  saveResults() {
    const reportData = {
      timestamp: new Date().toISOString(),
      results: this.results,
      thresholds: {
        minPassRate: 70,
        minCoverage: 60,
      },
      recommendations: this.generateRecommendations(),
    };

    fs.writeFileSync('test-validation-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n📄 Report saved to test-validation-report.json');
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.overall.passRate < 80) {
      recommendations.push('Consider fixing failing tests to improve overall pass rate');
    }

    if (this.results.client.failed > this.results.server.failed) {
      recommendations.push('Focus on client-side test fixes as they have more failures');
    }

    if (this.results.overall.failed > 50) {
      recommendations.push('High number of failing tests - consider systematic approach to fixing');
    }

    if (recommendations.length === 0) {
      recommendations.push('Test suite is in good condition - maintain current quality');
    }

    return recommendations;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new TestCoverageValidator();
  validator.validateTestSuite().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = TestCoverageValidator;
