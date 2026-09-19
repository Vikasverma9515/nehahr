/**
 * Automatic avatars for people in the app.
 *
 * Every person gets a face from a curated Open Peeps pool (public/peeps/{f,m,n}-N.svg):
 *  - the pool comes from the person's gender, inferred from their first name unless you pass one in;
 *  - the face within the pool comes from a stable hash of the full name, so the same person always
 *    gets the same face.
 *
 * Inferring gender from a name is only a best guess. Names that are unknown, ambiguous or not real
 * names ("test1") get the neutral pool. If you store a gender for people later, pass it as the second
 * argument of avatarFor() and it takes priority.
 */
export type Gender = "female" | "male" | "neutral";

/** Number of faces per pool. Keep in sync with `npm run peeps` (scripts/generate-peeps.mjs). */
export const POOL_SIZE = { f: 16, m: 15, n: 10 } as const;

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

const FEMALE = words(`
aadhya aanya aarti aditi aishwarya akansha alka amrita ananya anita anjali ankita anushka archana arti asha avni bhavna chitra deepa deepika devika
divya disha diya gauri geeta gita harini isha ishita jaya jyoti kajal kamala kavita kavya khushi kirti komal kriti lakshmi lata madhu mahima mansi
meena meera megha mitali mona mridula nandini neha neelam nidhi nikita nisha nita pallavi pooja prachi pragya preeti priya priyanka radha rashmi
reema rekha renu riya rita ritu roshni rupali sakshi sangeeta sanjana sapna sara sarita savita seema shalini shilpa shivani shreya shruti shweta
simran sita smita sneha sonal sonali sonia sunita supriya swati tanvi tanya tara trisha uma usha vandana varsha vidya yamini zoya fatima aisha ayesha
sana zara emma olivia ava sophia isabella mia amelia harper evelyn abigail emily ella elizabeth sofia scarlett grace chloe lily hannah zoe nora
maya sarah laura jessica jennifer lisa anna maria susan karen nancy betty linda barbara patricia mary sandra ashley kimberly donna michelle carol
amanda melissa deborah stephanie rebecca sharon cynthia kathleen amy angela shirley brenda pamela nicole samantha katherine christine helen debra
rachel carolyn janet catherine heather diane olga julia victoria alice ruby ivy hazel violet aria luna hana ada tess rosa ines lena nina ivy
`);

const MALE = words(`
aakash aarav abhishek aditya ajay akash akhil amit anand anil ankit anurag arjun arun ashish ashok aman bharat chetan deepak dev dinesh gaurav girish
gopal govind harish harsh hemant imran jatin kabir kamal karan kartik krishna kunal lokesh mahesh manish manoj mayank mohan mohit mukesh naveen
neeraj nikhil nitin om pankaj paras pradeep pranav prashant prateek pratik rahul raj rajat rajesh rakesh ramesh ravi rohan rohit sachin sagar sahil
sameer sandeep sanjay santosh saurabh shubham siddharth sumit sunil suresh surya tarun tushar uday umesh varun vijay vikas vikram vinay vinod
vishal vivek yash yogesh zaid farhan salman rizwan james john robert michael william david richard joseph thomas charles chris christopher daniel
matthew anthony mark donald steven paul andrew joshua kenneth kevin brian george timothy ronald jason edward jeffrey ryan jacob gary nicholas eric
jonathan stephen larry justin scott brandon benjamin samuel gregory alexander patrick frank raymond jack dennis jerry tyler aaron jose adam nathan
henry zachary douglas peter kyle noah ethan liam mason logan lucas oliver leo max theo finn jon lars wes cy ben dev omar luca zane owen hugo
ravindra rabindra narendra surendra mahendra jitendra devendra rajendra virendra dharmendra yogendra satyendra ramchandra chandra shiva ganesha krishna vishnu hari sudhir ranjit gurpreet harpreet amrit kailash mukund madhava nikola luka joshua
`);

/** Names used by all genders, or too short to call. */
const NEUTRAL = words("kiran sam alex jamie taylor jordan riley noor ash robin sasha charlie avery casey jesse morgan quinn skyler rowan");

/** Pulls a usable first name out of "Priya Patel", "priya.patel@x.com", "Dr. Priya" ... */
function firstName(fullName: string): string {
  const cleaned = fullName.replace(/@.*$/, "").replace(/[._-]+/g, " ").trim().toLowerCase();
  const parts = cleaned.split(/\s+/).filter((p) => !/^(dr|mr|mrs|ms|miss|prof|shri|smt)\.?$/.test(p));
  return (parts[0] ?? "").replace(/[^a-z]/g, "");
}

export function guessGender(fullName?: string | null): Gender {
  if (!fullName) return "neutral";
  const f = firstName(fullName);
  if (f.length < 2) return "neutral";
  if (NEUTRAL.has(f)) return "neutral";
  if (FEMALE.has(f)) return "female";
  if (MALE.has(f)) return "male";
  // Not in the lists: a light hint from the ending, only for names long enough to mean something.
  if (f.length >= 4 && /(a|i|ee|ie)$/.test(f)) return "female";
  return "neutral";
}

/** FNV-1a: a small, stable string hash. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Path of the avatar SVG for a person. Same name (and gender) always gives the same face. */
export function avatarFor(name?: string | null, gender?: Gender): string {
  const g = gender ?? guessGender(name);
  const pool = g === "female" ? "f" : g === "male" ? "m" : "n";
  const idx = (hash((name ?? "").trim().toLowerCase()) % POOL_SIZE[pool]) + 1;
  return `/peeps/${pool}-${idx}.svg`;
}
