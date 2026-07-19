import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URLS = 'http://127.0.0.1:5500';

  @IsUrl({ require_tld: false })
  SUPABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_PUBLISHABLE_KEY!: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsNotEmpty()
  SUPABASE_SECRET_KEY?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: true });
  if (errors.length) {
    throw new Error(
      `Configuração de ambiente inválida. Verifique: ${errors.map((error) => error.property).join(', ')}`,
    );
  }
  return validated;
}
