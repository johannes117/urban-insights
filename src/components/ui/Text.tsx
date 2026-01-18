interface TextProps {
  element: {
    props: {
      content: string
      variant?: 'heading' | 'subheading' | 'paragraph' | 'caption'
    }
  }
}

export function Text({ element }: TextProps) {
  const { content, variant = 'paragraph' } = element.props

  const styles = {
    heading: 'text-2xl font-bold text-gray-900',
    subheading: 'text-lg font-semibold text-gray-800',
    paragraph: 'text-base text-gray-700',
    caption: 'text-sm text-gray-500',
  }

  const Tag = variant === 'heading' ? 'h2' : variant === 'subheading' ? 'h3' : 'p'

  return <Tag className={styles[variant]}>{content}</Tag>
}
