import Image from "next/image"

type VoicyClawBrandIconProps = {
  alt: string
  size?: number
  className?: string
}

export function VoicyClawBrandIcon({
  alt,
  size = 40,
  className,
}: VoicyClawBrandIconProps) {
  return (
    <Image
      src="/voicyclaw-icon.svg"
      alt={alt}
      width={size}
      height={size}
      className={className}
      priority
    />
  )
}
