import { queueTypeLabel, buildChampionFallback, getChampionImageUrl, buildChampIdMap } from '@/lib/league'

describe('League utility functions', () => {
  it('queueTypeLabel maps queue IDs', () => {
    expect(queueTypeLabel(420)).toBe('Ranked Solo')
    expect(queueTypeLabel(440)).toBe('Ranked Flex')
    expect(queueTypeLabel(400)).toBe('Normal Draft')
    expect(queueTypeLabel(450)).toBe('ARAM')
    expect(queueTypeLabel(999)).toBe('Normal')
  })

  it('buildChampionFallback uppercases name', () => {
    expect(buildChampionFallback('Ahri')).toBe('AHRI')
    expect(buildChampionFallback('Twisted Fate')).toBe('TF')
  })

  it('getChampionImageUrl formats correctly', () => {
    expect(getChampionImageUrl('Ahri', '14.10.1')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/Ahri.png'
    )
  })

  it('buildChampIdMap inverts champion JSON data', () => {
    const champData = {
      data: {
        Ahri: { key: '103', name: 'Ahri' },
        Lux: { key: '99', name: 'Lux' },
      },
    }
    const map = buildChampIdMap(champData)
    expect(map['103']).toBe('Ahri')
    expect(map['99']).toBe('Lux')
  })
})
