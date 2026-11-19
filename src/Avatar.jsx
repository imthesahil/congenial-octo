export default function Avatar({ name, size = 'w-10 h-10' }) {
  return (
    <div className={`${size} rounded-full bg-blue-600 flex items-center justify-center font-semibold uppercase shrink-0`}>
      {name[0]}
    </div>
  )
}