import { getProjectByRepositoryId } from '../src/lib/projects-repository'

// FoxNoseTech/diarize 的实际 repositoryId
const projects = await Promise.all([
  getProjectByRepositoryId('1102340385'),
])

for (const project of projects) {
  if (!project) { console.log('不存在'); continue }
  
  const raw = project.readmeContent || ''
  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  console.log('项目:', project.fullName)
  console.log('原始 README 长度:', raw.length)
  console.log('清洗后长度:', cleaned.length)
  console.log('截取1500后:', cleaned.slice(0, 1500).length)
  console.log('前500字符:')
  console.log(cleaned.slice(0, 500))
  console.log('')
}
