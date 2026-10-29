import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // claude-reporter/, server-agent/ and the KOReader plugin have their own tests
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/claude-reporter/', '<rootDir>/server-agent/', '<rootDir>/koreader-plugin/'],
}

export default createJestConfig(config)
