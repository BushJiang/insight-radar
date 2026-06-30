import { ZodError } from 'zod'
import { handleZodError } from '@/lib/api-validation'
import { getAppSettingsSnapshot, saveAppSettings } from '@/lib/app-settings-service'
import { appSettingsSchema } from '@/validations/api-schemas'

export async function GET() {
  try {
    return Response.json(await getAppSettingsSnapshot())
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '读取设置失败。' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = appSettingsSchema.parse(await req.json())

    return Response.json(await saveAppSettings(body))
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error)

    return Response.json({ error: error instanceof Error ? error.message : '保存设置失败。' }, { status: 500 })
  }
}
